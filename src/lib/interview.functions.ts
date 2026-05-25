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
  .inputValidator((input) =>
    z.object({
      slug: z.string().min(1).max(100),
      consent_version: z.string().min(1).max(50).optional(),
      user_agent: z.string().max(500).optional(),
    }).parse(input),
  )
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

    return { interview_id: interviewId };
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
      await supabaseAdmin.from("answers").update({ status: "failed", error_message: dlErr?.message ?? "Falha ao baixar vídeo" }).eq("id", ans.id);
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

      // Best-effort auto quality scoring (does not block the pipeline).
      try { await scoreAnswerInternal(ans.id, transcript); } catch (err) { console.error("quality score failed", err); }
    } catch (e) {
      await supabaseAdmin.from("answers").update({
        status: "failed",
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

// Researcher: list interviews for a study
export const listStudyInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: study } = await supabase.from("studies").select("id, owner_id, title").eq("id", data.study_id).maybeSingle();
    if (!study || study.owner_id !== userId) throw new Error("Acesso negado.");
    const { data: interviews, error } = await supabase
      .from("interviews")
      .select("id, status, started_at, finished_at, respondent_id")
      .eq("study_id", data.study_id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (interviews ?? []).map((i) => i.id);
    let counts: Record<string, { total: number; ready: number }> = {};
    if (ids.length > 0) {
      const { data: ans } = await supabaseAdmin
        .from("answers").select("interview_id, status").in("interview_id", ids);
      counts = (ans ?? []).reduce((acc, a) => {
        const c = acc[a.interview_id] ?? { total: 0, ready: 0 };
        c.total += 1;
        if (a.status === "ready") c.ready += 1;
        acc[a.interview_id] = c;
        return acc;
      }, {} as Record<string, { total: number; ready: number }>);
    }
    return {
      study: { id: study.id, title: study.title },
      interviews: (interviews ?? []).map((i) => ({ ...i, answer_count: counts[i.id]?.total ?? 0, ready_count: counts[i.id]?.ready ?? 0 })),
    };
  });

// Researcher: full interview detail (answers + signed video urls)
export const getInterviewDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv, error: ivErr } = await supabase
      .from("interviews")
      .select("id, study_id, status, started_at, finished_at, respondent_id, studies:study_id(id, title, owner_id)")
      .eq("id", data.interview_id)
      .maybeSingle() as { data: { id: string; study_id: string; status: string; started_at: string; finished_at: string | null; respondent_id: string; studies: { id: string; title: string; owner_id: string } | null } | null; error: { message: string } | null };
    if (ivErr) throw new Error(ivErr.message);
    if (!iv || iv.studies?.owner_id !== userId) throw new Error("Acesso negado.");

    const { data: answers } = await supabaseAdmin
      .from("answers")
      .select("id, question_id, question_text, transcript, is_followup, parent_answer_id, status, error_message, duration_seconds, created_at, video_path")
      .eq("interview_id", data.interview_id)
      .order("created_at", { ascending: true });

    const enriched = await Promise.all(
      (answers ?? []).map(async (a) => {
        const path = `${data.interview_id}/${a.id}.webm`;
        const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        return { ...a, video_url: signed?.signedUrl ?? null };
      }),
    );

    return {
      interview: {
        id: iv.id,
        study_id: iv.study_id,
        study_title: iv.studies?.title ?? "",
        status: iv.status,
        started_at: iv.started_at,
        finished_at: iv.finished_at,
      },
      answers: enriched,
    };
  });

// Aggregated pipeline status for one interview — used by the status panel.
// Authorized for the interview's respondent OR the owning study's owner.
export const getInterviewPipelineStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: iv } = await supabaseAdmin
      .from("interviews")
      .select("id, study_id, status, respondent_id, studies:study_id(owner_id, max_followups)")
      .eq("id", data.interview_id)
      .maybeSingle() as { data: { id: string; study_id: string; status: string; respondent_id: string; studies: { owner_id: string; max_followups: number } | null } | null };
    if (!iv) throw new Error("Entrevista não encontrada.");
    const isRespondent = iv.respondent_id === userId;
    const isOwner = iv.studies?.owner_id === userId;
    if (!isRespondent && !isOwner) throw new Error("Acesso negado.");

    const { data: answers } = await supabaseAdmin
      .from("answers")
      .select("id, question_id, is_followup, status, error_message, transcript, created_at, updated_at")
      .eq("interview_id", data.interview_id)
      .order("created_at", { ascending: true });
    const ans = answers ?? [];

    const counts = {
      total: ans.length,
      uploading: ans.filter((a) => a.status === "uploading").length,
      transcribing: ans.filter((a) => a.status === "transcribing").length,
      ready: ans.filter((a) => a.status === "ready").length,
      failed: ans.filter((a) => a.status === "failed").length,
    };
    const last = ans[ans.length - 1] ?? null;

    // Followup state — derived from the last answered question
    let followupState: "idle" | "deciding" | "ready" | "skipped" | "exhausted" = "idle";
    if (last) {
      const sameQ = ans.filter((a) => a.question_id === last.question_id);
      const followups = sameQ.filter((a) => a.is_followup);
      const maxFu = iv.studies?.max_followups ?? 2;
      const allReady = sameQ.every((a) => a.status === "ready");
      if (followups.length >= maxFu) followupState = "exhausted";
      else if (!allReady) followupState = "deciding";
      else {
        // last answer is ready; if a new followup row exists after it → ready
        const newer = ans.find((a) => a.is_followup && new Date(a.created_at) > new Date(last.created_at));
        if (newer) followupState = "ready";
        else if (last.is_followup) followupState = "skipped";
        else followupState = "skipped";
      }
    }

    // Synthesis state — per study
    const [{ data: insights }, { data: recs }] = await Promise.all([
      supabaseAdmin.from("insights").select("id, created_at").eq("study_id", iv.study_id).order("created_at", { ascending: false }).limit(1),
      supabaseAdmin.from("recommendations").select("id, created_at").eq("study_id", iv.study_id).order("created_at", { ascending: false }).limit(1),
    ]);
    const lastInsight = insights?.[0]?.created_at ?? null;
    const lastRec = recs?.[0]?.created_at ?? null;
    const lastGenerated = [lastInsight, lastRec].filter(Boolean).sort().reverse()[0] ?? null;

    return {
      interview_status: iv.status,
      study_id: iv.study_id,
      answers: counts,
      last_answer: last
        ? { id: last.id, status: last.status, error_message: last.error_message, updated_at: last.updated_at }
        : null,
      followup: { state: followupState },
      synthesis: {
        has_insights: (insights?.length ?? 0) > 0,
        has_recommendations: (recs?.length ?? 0) > 0,
        last_generated_at: lastGenerated,
      },
    };
  });
