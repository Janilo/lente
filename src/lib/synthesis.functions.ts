import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertOwner(study_id: string, userId: string) {
  const { data: s } = await supabaseAdmin.from("studies").select("id, owner_id, title, business_goal, context, target_audience").eq("id", study_id).maybeSingle();
  if (!s || s.owner_id !== userId) throw new Error("Acesso negado.");
  return s;
}

export const listSynthesis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ study_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(data.study_id, context.userId);
    const [{ data: insights }, { data: recs }] = await Promise.all([
      supabaseAdmin.from("insights").select("id, theme, summary, evidence, created_at").eq("study_id", data.study_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("recommendations").select("id, title, rationale, priority, supporting_insight_ids, created_at").eq("study_id", data.study_id).order("priority", { ascending: true, nullsFirst: false }),
    ]);
    return { insights: insights ?? [], recommendations: recs ?? [] };
  });

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
      .select("id, interview_id, question_text, transcript, is_followup, status")
      .in("interview_id", ids)
      .eq("status", "ready");

    const ready = (answers ?? []).filter((a) => a.transcript && a.transcript.trim().length > 0);
    if (ready.length === 0) throw new Error("Nenhuma transcrição disponível ainda.");

    // Group by interview
    const byInterview = new Map<string, typeof ready>();
    for (const a of ready) {
      const arr = byInterview.get(a.interview_id) ?? [];
      arr.push(a);
      byInterview.set(a.interview_id, arr);
    }

    const transcriptBlocks: string[] = [];
    let idx = 0;
    for (const [iid, arr] of byInterview) {
      idx++;
      const lines = arr.map((a) => `  ${a.is_followup ? "↳ (follow-up) " : ""}P: ${a.question_text}\n    R: ${a.transcript}`).join("\n");
      transcriptBlocks.push(`Entrevista ${idx} (id=${iid}):\n${lines}`);
    }
    let corpus = transcriptBlocks.join("\n\n");
    if (corpus.length > 60000) corpus = corpus.slice(0, 60000) + "\n\n[truncado]";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente.");

    const system = `Você é um pesquisador sênior de UX/Insights. Sintetize entrevistas em profundidade em temas (insights) e recomendações acionáveis. Sempre responda em PORTUGUÊS. Seja específico — cite trechos curtos das falas como evidência.`;

    const user = `Estudo: ${study.title}
Objetivo de negócio: ${study.business_goal ?? "(não informado)"}
Contexto: ${study.context ?? "(não informado)"}
Público-alvo: ${study.target_audience ?? "(não informado)"}

Transcrições (${byInterview.size} entrevistas):
${corpus}

Tarefa: extraia 4-8 INSIGHTS (temas/padrões) e 3-6 RECOMENDAÇÕES acionáveis ligadas a esses insights. Use a tool 'submit_synthesis'.`;

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
                        quote: { type: "string", description: "Trecho curto da fala do respondente (até 280 chars)." },
                        interview_index: { type: "integer", description: "Número da entrevista (1-based) de onde a fala veio." },
                      },
                      required: ["quote", "interview_index"],
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
    let parsed: { insights: Array<{ theme: string; summary: string; evidence: Array<{ quote: string; interview_index: number }> }>; recommendations: Array<{ title: string; rationale: string; priority: number; supporting_insight_indices: number[] }> };
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("Falha ao interpretar resposta da IA.");
    }

    // Replace previous synthesis
    await supabaseAdmin.from("recommendations").delete().eq("study_id", data.study_id);
    await supabaseAdmin.from("insights").delete().eq("study_id", data.study_id);

    const insightsToInsert = (parsed.insights ?? []).map((ins) => ({
      study_id: data.study_id,
      theme: ins.theme.slice(0, 200),
      summary: ins.summary,
      evidence: ins.evidence ?? [],
    }));
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
