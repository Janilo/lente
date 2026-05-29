import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertOwner(study_id: string, userId: string) {
  const { data: s } = await supabaseAdmin.from("studies").select("id, owner_id, title, business_goal, context, target_audience").eq("id", study_id).maybeSingle();
  if (!s || s.owner_id !== userId) throw new Error("Acesso negado.");
  return s;
}

// ─────────────────────── word-level clip resolver ───────────────────────

type NormWord = { text: string; start: number; end: number };

function normalizeWords(raw: unknown): NormWord[] {
  if (!Array.isArray(raw)) return [];
  const out: NormWord[] = [];
  // Detect ms vs s: if any end > 600 we assume ms (AssemblyAI), else s (ElevenLabs).
  let maxEnd = 0;
  for (const w of raw) {
    if (typeof w !== "object" || w === null) continue;
    const t = (w as { text?: unknown; word?: unknown }).text ?? (w as { word?: unknown }).word;
    const s = (w as { start?: unknown }).start;
    const e = (w as { end?: unknown }).end;
    if (typeof t !== "string" || typeof s !== "number" || typeof e !== "number") continue;
    maxEnd = Math.max(maxEnd, e);
  }
  const divisor = maxEnd > 600 ? 1000 : 1;
  for (const w of raw) {
    if (typeof w !== "object" || w === null) continue;
    const t = (w as { text?: unknown; word?: unknown }).text ?? (w as { word?: unknown }).word;
    const s = (w as { start?: unknown }).start;
    const e = (w as { end?: unknown }).end;
    if (typeof t !== "string" || typeof s !== "number" || typeof e !== "number") continue;
    out.push({ text: String(t), start: s / divisor, end: e / divisor });
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Locate quote span inside words_json. Returns [start, end] seconds or null. */
function locateQuoteClip(quote: string, words: NormWord[]): { start: number; end: number } | null {
  if (words.length === 0) return null;
  const qTokens = normalizeForMatch(quote).split(" ").filter(Boolean);
  if (qTokens.length === 0) return null;
  const wTokens = words.map((w) => normalizeForMatch(w.text));

  // Sliding window — best contiguous overlap.
  let bestScore = 0;
  let bestStartIdx = -1;
  let bestEndIdx = -1;
  const windowSize = Math.min(qTokens.length + 4, wTokens.length);
  for (let i = 0; i <= wTokens.length - 1; i++) {
    const end = Math.min(i + windowSize, wTokens.length);
    const slice = wTokens.slice(i, end);
    let matches = 0;
    for (const tok of qTokens) {
      if (slice.includes(tok)) matches++;
    }
    if (matches > bestScore) {
      bestScore = matches;
      // Tight bounds: first and last token of quote inside slice.
      let firstHit = -1;
      let lastHit = -1;
      for (let j = 0; j < slice.length; j++) {
        if (qTokens.includes(slice[j])) {
          if (firstHit < 0) firstHit = j;
          lastHit = j;
        }
      }
      bestStartIdx = i + Math.max(0, firstHit);
      bestEndIdx = i + Math.max(firstHit, lastHit);
    }
  }
  // Need at least 40% of quote tokens matched to trust the match.
  if (bestScore < Math.max(2, Math.ceil(qTokens.length * 0.4))) return null;
  if (bestStartIdx < 0 || bestEndIdx < 0) return null;
  const start = Math.max(0, words[bestStartIdx].start - 0.4);
  const end = words[bestEndIdx].end + 0.6;
  return { start, end };
}

// ─────────────────────── listSynthesis ───────────────────────

export const listSynthesis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ study_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(data.study_id, context.userId);
    const [{ data: insights }, { data: recs }] = await Promise.all([
      supabaseAdmin.from("insights").select("id, theme, summary, evidence, created_at").eq("study_id", data.study_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("recommendations").select("id, title, rationale, priority, supporting_insight_ids, created_at").eq("study_id", data.study_id).order("priority", { ascending: true, nullsFirst: false }),
    ]);

    // Collect unique video paths from evidence and sign them.
    const paths = new Set<string>();
    for (const ins of insights ?? []) {
      const ev = (ins.evidence as Array<{ video_path?: string | null }> | null) ?? [];
      for (const e of ev) if (e.video_path) paths.add(e.video_path);
    }
    const signed = new Map<string, string>();
    if (paths.size > 0) {
      const { data: signedList } = await supabaseAdmin.storage
        .from("interview-videos")
        .createSignedUrls([...paths], 60 * 60);
      for (const s of signedList ?? []) {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      }
    }

    // Inject signed URL onto each evidence item.
    const enriched = (insights ?? []).map((ins) => {
      const ev = (ins.evidence as Array<Record<string, unknown>> | null) ?? [];
      return {
        ...ins,
        evidence: ev.map((e) => ({
          ...e,
          video_url: typeof e.video_path === "string" ? signed.get(e.video_path) ?? null : null,
        })),
      };
    });

    return { insights: enriched, recommendations: recs ?? [] };
  });

// ─────────────────────── generateSynthesis ───────────────────────

export const generateSynthesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ study_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const study = await assertOwner(data.study_id, context.userId);

    const { data: interviews } = await supabaseAdmin
      .from("interviews").select("id, status").eq("study_id", data.study_id);
    const ids = (interviews ?? []).map((i) => i.id);
    if (ids.length === 0) throw new Error("Nenhuma entrevista para sintetizar ainda.");

    const { data: answers } = await supabaseAdmin
      .from("answers")
      .select("id, interview_id, question_text, transcript, is_followup, status, video_path, start_seconds, end_seconds, words_json")
      .in("interview_id", ids)
      .eq("status", "ready");

    const ready = (answers ?? []).filter((a) => a.transcript && a.transcript.trim().length > 0);
    if (ready.length === 0) throw new Error("Nenhuma transcrição disponível ainda.");

    // Group by interview, assign reference codes A1, A2, ... for the LLM.
    const byInterview = new Map<string, typeof ready>();
    for (const a of ready) {
      const arr = byInterview.get(a.interview_id) ?? [];
      arr.push(a);
      byInterview.set(a.interview_id, arr);
    }

    const answersByRef = new Map<string, (typeof ready)[number]>();
    const transcriptBlocks: string[] = [];
    let interviewIdx = 0;
    let answerSeq = 0;
    for (const [iid, arr] of byInterview) {
      interviewIdx++;
      const lines: string[] = [];
      for (const a of arr) {
        answerSeq++;
        const ref = `A${answerSeq}`;
        answersByRef.set(ref, a);
        const tag = a.is_followup ? "↳ (follow-up) " : "";
        lines.push(`  [${ref}] ${tag}P: ${a.question_text}\n    R: ${a.transcript}`);
      }
      transcriptBlocks.push(`Entrevista ${interviewIdx} (id=${iid}):\n${lines.join("\n")}`);
    }
    let corpus = transcriptBlocks.join("\n\n");
    if (corpus.length > 60000) corpus = corpus.slice(0, 60000) + "\n\n[truncado]";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente.");

    const system = `Você é um pesquisador sênior de UX/Insights. Sintetize entrevistas em profundidade em temas (insights) e recomendações acionáveis. Sempre responda em PORTUGUÊS. Cada evidência DEVE referenciar o código [Ax] da resposta de onde a citação saiu — copie a quote literalmente da transcrição daquela resposta.`;

    const user = `Estudo: ${study.title}
Objetivo de negócio: ${study.business_goal ?? "(não informado)"}
Contexto: ${study.context ?? "(não informado)"}
Público-alvo: ${study.target_audience ?? "(não informado)"}

Transcrições (${byInterview.size} entrevistas). Cada resposta tem um código [Ax]:
${corpus}

Tarefa: extraia 4-8 INSIGHTS e 3-6 RECOMENDAÇÕES acionáveis. Para cada evidência, retorne answer_ref="Ax" (exatamente como aparece) e quote (trecho LITERAL da resposta correspondente).`;

    const tool = {
      type: "function",
      function: {
        name: "submit_synthesis",
        description: "Retorna insights e recomendações estruturados.",
        parameters: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  theme: { type: "string", description: "Título curto do tema (até 80 chars)." },
                  summary: { type: "string", description: "2-4 frases explicando o insight." },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        quote: { type: "string", description: "Trecho LITERAL da fala (até 280 chars) — copiado da resposta referenciada." },
                        answer_ref: { type: "string", description: "Código da resposta no formato 'Ax' (ex: A12)." },
                      },
                      required: ["quote", "answer_ref"],
                    },
                  },
                },
                required: ["theme", "summary", "evidence"],
              },
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Recomendação acionável (até 120 chars)." },
                  rationale: { type: "string", description: "2-4 frases justificando com base nos insights." },
                  priority: { type: "integer", description: "1=alta, 2=média, 3=baixa.", minimum: 1, maximum: 3 },
                  supporting_insight_indices: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Índices (1-based) dos insights desta resposta que suportam a recomendação.",
                  },
                },
                required: ["title", "rationale", "priority", "supporting_insight_indices"],
              },
            },
          },
          required: ["insights", "recommendations"],
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_synthesis" } },
      }),
    });
    if (res.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`IA: ${res.status}`);
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("IA não retornou síntese estruturada.");
    let parsed: {
      insights: Array<{ theme: string; summary: string; evidence: Array<{ quote: string; answer_ref: string }> }>;
      recommendations: Array<{ title: string; rationale: string; priority: number; supporting_insight_indices: number[] }>;
    };
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("Falha ao interpretar resposta da IA.");
    }

    // Map answer → interview index for display.
    const interviewIndexById = new Map<string, number>();
    {
      let n = 0;
      for (const iid of byInterview.keys()) {
        n++;
        interviewIndexById.set(iid, n);
      }
    }

    // Replace previous synthesis
    await supabaseAdmin.from("recommendations").delete().eq("study_id", data.study_id);
    await supabaseAdmin.from("insights").delete().eq("study_id", data.study_id);

    const insightsToInsert = (parsed.insights ?? []).map((ins) => {
      const enrichedEvidence = (ins.evidence ?? []).map((ev) => {
        const a = answersByRef.get(ev.answer_ref);
        if (!a) {
          return { quote: ev.quote, answer_ref: ev.answer_ref, interview_index: null, video_path: null, clip_start: null, clip_end: null };
        }
        const words = normalizeWords(a.words_json);
        const located = locateQuoteClip(ev.quote, words);
        const baseStart = a.start_seconds ?? 0;
        const baseEnd = a.end_seconds ?? (a.duration_seconds ?? null);
        return {
          quote: ev.quote,
          answer_ref: ev.answer_ref,
          answer_id: a.id,
          interview_index: interviewIndexById.get(a.interview_id) ?? null,
          video_path: a.video_path ?? null,
          clip_start: located ? located.start : baseStart,
          clip_end: located ? located.end : baseEnd,
          question_text: a.question_text,
        };
      });
      return {
        study_id: data.study_id,
        theme: ins.theme.slice(0, 200),
        summary: ins.summary,
        evidence: enrichedEvidence,
      };
    });

    const { data: insertedInsights, error: iErr } = await supabaseAdmin
      .from("insights").insert(insightsToInsert).select("id");
    if (iErr) throw new Error(iErr.message);
    const insightIds = (insertedInsights ?? []).map((r) => r.id);

    const recsToInsert = (parsed.recommendations ?? []).map((r) => ({
      study_id: data.study_id,
      title: r.title.slice(0, 200),
      rationale: r.rationale,
      priority: r.priority,
      supporting_insight_ids: (r.supporting_insight_indices ?? [])
        .map((idx) => insightIds[idx - 1])
        .filter((x): x is string => !!x),
    }));
    if (recsToInsert.length > 0) {
      const { error: rErr } = await supabaseAdmin.from("recommendations").insert(recsToInsert);
      if (rErr) throw new Error(rErr.message);
    }

    return { ok: true, insight_count: insightsToInsert.length, recommendation_count: recsToInsert.length };
  });
