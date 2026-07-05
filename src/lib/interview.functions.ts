// The respondent's interview runner: fetch the study, start/resume a session,
// decide the next step and finish. One slice, one purpose (F-A1). Its
// neighbours: answer-pipeline.functions.ts (upload → transcription),
// interview-status.functions.ts (status panel), study-interviews.read.ts
// (researcher views), interview-decision.ts (pure next-step decision).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatUrl } from "./ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncContact } from "./hubspot.server";
import { decideNextStep, type DecisionAnswer, type DecisionQuestion } from "./interview-decision";
import { assertInterviewRespondent } from "./authz";
import { adminGetUserContact } from "./admin-ops.server";

// Público: resolve o slug via service-role, filtrando publicado — anon não lê
// studies pela API (decisão F-RLS-2; ver ARCHITECTURE.md).
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
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().min(1).max(100),
        consent_version: z.string().min(1).max(50).optional(),
        user_agent: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: study, error: sErr } = await supabaseAdmin
      .from("studies")
      .select("id, status")
      .eq("public_slug", data.slug)
      .maybeSingle();
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

    let interviewId: string;
    if (existing && existing.status === "in_progress") {
      interviewId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("interviews")
        .insert({ study_id: study.id, respondent_id: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      interviewId = created.id;
    }

    // Record LGPD consent if provided (idempotent via UNIQUE(interview_id,user_id))
    if (data.consent_version) {
      await supabaseAdmin.from("consents").upsert(
        {
          interview_id: interviewId,
          user_id: userId,
          study_id: study.id,
          consent_version: data.consent_version,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "interview_id,user_id", ignoreDuplicates: true },
      );
    }

    // Fire-and-forget HubSpot sync for respondent (with study context).
    try {
      const { data: studyFull } = await supabaseAdmin
        .from("studies")
        .select("id, title, public_slug")
        .eq("id", study.id)
        .maybeSingle();
      const contact = await adminGetUserContact(userId);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const email = contact.email;
      if (email && studyFull) {
        await syncContact({
          email,
          full_name: profile?.full_name ?? contact.fullName,
          role: "respondent",
          study: { id: studyFull.id, title: studyFull.title, slug: studyFull.public_slug },
        });
      }
    } catch (e) {
      console.warn("[hubspot] respondent sync error:", e);
    }

    return { interview_id: interviewId };
  });

// Decide what the next step is for an interview
export async function computeNextStep(interview_id: string) {
  const { data: interview, error: iErr } = await supabaseAdmin
    .from("interviews")
    .select("id, study_id, status")
    .eq("id", interview_id)
    .single();
  if (iErr || !interview) throw new Error("Entrevista não encontrada.");

  const { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, text, intent, position")
    .eq("study_id", interview.study_id)
    .order("position");
  const { data: answers } = await supabaseAdmin
    .from("answers")
    .select("id, question_id, is_followup, parent_answer_id, transcript, question_text, status")
    .eq("interview_id", interview_id);
  const { data: study } = await supabaseAdmin
    .from("studies")
    .select("max_followups, context, target_audience, business_goal, title")
    .eq("id", interview.study_id)
    .single();

  return decideNextStep({
    interviewStatus: interview.status,
    questions: (questions ?? []) as DecisionQuestion[],
    answers: (answers ?? []) as DecisionAnswer[],
    maxFollowups: study?.max_followups ?? 2,
    studyContext: `${study?.title ?? ""}\n${study?.business_goal ?? ""}\n${study?.context ?? ""}\nPúblico: ${study?.target_audience ?? ""}`,
    askFollowup: maybeGenerateFollowup,
  });
}

async function maybeGenerateFollowup(args: {
  studyContext: string;
  originalQuestion: string;
  originalIntent: string;
  transcripts: string;
  previousFollowups: string;
  followupsRemaining: number;
}): Promise<string | null> {
  const apiKey = process.env.AI_API_KEY;
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
    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
    const { supabase, userId } = context;
    const iv = await assertInterviewRespondent(supabase, data.interview_id, userId);
    const next = await computeNextStep(data.interview_id);

    const { count: question_count } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("study_id", (iv as any).study_id);
    const { data: study } = await supabaseAdmin
      .from("studies")
      .select("max_followups")
      .eq("id", (iv as any).study_id)
      .single();
    const max_followups = study?.max_followups ?? 2;

    let current_position: number | null = null;
    let followups_done_for_current = 0;
    if (next.type === "question" || next.type === "followup") {
      current_position = (next as any).position ?? null;
      const { data: ansForQ } = await supabaseAdmin
        .from("answers")
        .select("id, is_followup, status")
        .eq("interview_id", data.interview_id)
        .eq("question_id", (next as any).question_id);
      followups_done_for_current = (ansForQ ?? []).filter(
        (a) => a.is_followup && a.status !== "failed",
      ).length;
    }

    return {
      next,
      totals: {
        question_count: question_count ?? 0,
        current_position,
        followups_done_for_current,
        max_followups,
        is_followup: next.type === "followup",
      },
    };
  });

export const finishInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertInterviewRespondent(supabase, data.interview_id, userId);
    await supabase
      .from("interviews")
      .update({ status: "completed", finished_at: new Date().toISOString() })
      .eq("id", data.interview_id);
    return { ok: true };
  });
