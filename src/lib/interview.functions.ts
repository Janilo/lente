import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "interview-videos";

// Public: get study by slug (anon allowed via RLS for published)
export const getStudyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { data: study, error } = await supabaseAdmin
      .from("studies")
      .select("id, title, context, target_audience, status, max_followups")
      .eq("public_slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!study) throw new Error("Estudo não encontrado ou não publicado.");
    const { count } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("study_id", study.id);
    return { study, questionCount: count ?? 0 };
  });

// Start or resume an interview
export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: study, error: sErr } = await supabaseAdmin
      .from("studies").select("id, status").eq("public_slug", data.slug).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!study || study.status !== "published") throw new Error("Estudo indisponível.");

    const { data: existing } = await supabase
      .from("interviews")
      .select("id, status")
      .eq("study_id", study.id)
      .eq("respondent_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status === "in_progress") {
      return { interview_id: existing.id };
    }
    const { data: created, error } = await supabase
      .from("interviews")
      .insert({ study_id: study.id, respondent_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { interview_id: created.id };
  });

// Decide what the next step is for an interview
async function computeNextStep(interview_id: string) {
  const { data: interview, error: iErr } = await supabaseAdmin
    .from("interviews").select("id, study_id, status").eq("id", interview_id).single();
  if (iErr || !interview) throw new Error("Entrevista não encontrada.");
  if (interview.status === "completed") return { type: "done" as const };

  const { data: questions } = await supabaseAdmin
    .from("questions").select("id, text, intent, position").eq("study_id", interview.study_id).order("position");
  const { data: answers } = await supabaseAdmin
    .from("answers").select("id, question_id, is_followup, parent_answer_id, transcript, question_text, status")
    .eq("interview_id", interview_id);

  const { data: study } = await supabaseAdmin
    .from("studies").select("max_followups, context, target_audience, business_goal, title").eq("id", interview.study_id).single();
  const maxFollowups = study?.max_followups ?? 2;

  const qs = questions ?? [];
  const ans = answers ?? [];

  for (const q of qs) {
    const forQ = ans.filter((a) => a.question_id === q.id);
    if (forQ.length === 0) {
      return { type: "question" as const, question_id: q.id, text: q.text, intent: q.intent ?? "", position: q.position };
    }
    const ready = forQ.filter((a) => a.status === "ready" && a.transcript);
    if (ready.length < forQ.length) {
      // still processing
      return { type: "processing" as const };
    }
    const followups = forQ.filter((a) => a.is_followup);
    if (followups.length < maxFollowups) {
      // ask AI if a followup is needed
      const lastAnswer = forQ[forQ.length - 1];
      const previousFollowups = followups.map((f) => `- Pergunta: ${f.question_text}\n  Resposta: ${f.transcript}`).join("\n");
      const transcripts = forQ.map((a) => `[${a.is_followup ? "Follow-up" : "Original"}] ${a.question_text}\n→ ${a.transcript}`).join("\n\n");
      const fu = await maybeGenerateFollowup({
        studyContext: `${study?.title ?? ""}\n${study?.business_goal ?? ""}\n${study?.context ?? ""}\nPúblico: ${study?.target_audience ?? ""}`,
        originalQuestion: q.text,
        originalIntent: q.intent ?? "",
        transcripts,
        previousFollowups,
        followupsRemaining: maxFollowups - followups.length,
      });
      if (fu) {
        return {
          type: "followup" as const,
          question_id: q.id,
          text: fu,
          intent: q.intent ?? "",
          parent_answer_id: lastAnswer.id,
          position: q.position,
        };
      }
    }
    // move on
  }
  // all questions handled
  return { type: "done" as const };
}

async function maybeGenerateFollowup(args: {
  studyContext: string;
  originalQuestion: string;
  originalIntent: string;
  transcripts: string;
  previousFollowups: string;
  followupsRemaining: number;
}): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const system = `Você é um pesquisador de UX conduzindo uma entrevista em profundidade. Decida se vale a pena fazer UMA pergunta de aprofundamento (follow-up) com base no que o respondente disse.

Regras:
- Só gere follow-up se a resposta foi vaga, superficial, contraditória, ou se há um insight valioso a explorar.
- A pergunta deve ser curta, aberta, em português, sem julgamento, baseada na fala do respondente.
- Se não fizer sentido aprofundar, responda exatamente: SKIP`;
  const user = `Contexto do estudo:
${args.studyContext}

Pergunta original: ${args.originalQuestion}
Intenção: ${args.originalIntent}

Histórico de respostas para esta pergunta:
${args.transcripts}

${args.previousFollowups ? `Follow-ups já feitos:\n${args.previousFollowups}\n` : ""}
Follow-ups restantes: ${args.followupsRemaining}

Gere o follow-up (ou "SKIP").`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!text || text.toUpperCase().startsWith("SKIP")) return null;
    return text.replace(/^["']|["']$/g, "");
  } catch {
    return null;
  }
}

export const getNextStep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // verify respondent
    const { supabase, userId } = context;
    const { data: iv } = await supabase.from("interviews").select("id, respondent_id").eq("id", data.interview_id).maybeSingle();
    if (!iv || iv.respondent_id !== userId) throw new Error("Acesso negado.");
    const next = await computeNextStep(data.interview_id);
    return { next };
  });

// Create an answer row (uploading), returns ID + storage path
export const createAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      interview_id: z.string().uuid(),
      question_id: z.string().uuid(),
      question_text: z.string().min(1).max(2000),
      is_followup: z.boolean(),
      parent_answer_id: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = await supabase.from("interviews").select("id, respondent_id").eq("id", data.interview_id).maybeSingle();
    if (!iv || iv.respondent_id !== userId) throw new Error("Acesso negado.");
    const { data: ans, error } = await supabase.from("answers").insert({
      interview_id: data.interview_id,
      question_id: data.question_id,
      question_text: data.question_text,
      is_followup: data.is_followup,
      parent_answer_id: data.parent_answer_id ?? null,
      status: "uploading",
    }).select("id").single();
    if (error) throw new Error(error.message);
    const path = `${data.interview_id}/${ans.id}.webm`;
    return { answer_id: ans.id, path };
  });

// After client uploaded video → transcribe and update
export const processAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ answer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ans } = await supabase
      .from("answers")
      .select("id, interview_id, status, interviews:interview_id(respondent_id)")
      .eq("id", data.answer_id)
      .maybeSingle() as { data: { id: string; interview_id: string; status: string; interviews: { respondent_id: string } | null } | null };
    if (!ans || ans.interviews?.respondent_id !== userId) throw new Error("Acesso negado.");

    await supabaseAdmin.from("answers").update({ status: "transcribing" }).eq("id", ans.id);

    const path = `${ans.interview_id}/${ans.id}.webm`;
    const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (dlErr || !file) {
      await supabaseAdmin.from("answers").update({ status: "error", error_message: dlErr?.message ?? "Falha ao baixar vídeo" }).eq("id", ans.id);
      throw new Error("Falha ao recuperar gravação.");
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");

    try {
      const form = new FormData();
      form.append("file", file, "answer.webm");
      form.append("model_id", "scribe_v2");
      form.append("language_code", "por");
      form.append("diarize", "false");

      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`ElevenLabs: ${res.status} ${txt.slice(0, 200)}`);
      }
      const json = await res.json();
      const transcript = (json.text ?? "").trim();
      await supabaseAdmin.from("answers").update({
        status: "ready",
        transcript,
        words_json: json.words ?? null,
      }).eq("id", ans.id);
    } catch (e) {
      await supabaseAdmin.from("answers").update({
        status: "error",
        error_message: e instanceof Error ? e.message : "Erro desconhecido",
      }).eq("id", ans.id);
      throw e;
    }

    const next = await computeNextStep(ans.interview_id);
    if (next.type === "done") {
      await supabaseAdmin.from("interviews").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", ans.interview_id);
    }
    return { next };
  });

export const finishInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = await supabase.from("interviews").select("id, respondent_id").eq("id", data.interview_id).maybeSingle();
    if (!iv || iv.respondent_id !== userId) throw new Error("Acesso negado.");
    await supabase.from("interviews").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", data.interview_id);
    return { ok: true };
  });
