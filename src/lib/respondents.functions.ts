import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminGetUserEmail, signedVideoUrl } from "./admin-ops.server";
import { scoreAnswerInternal } from "@/lib/answer-quality";
import {
  assertRowAnswerStudyOwner,
  assertRowRespondentOrStudyOwner,
  assertStudyOwner,
} from "./authz";

const BUCKET = "interview-videos";

// Researcher: list respondents for a study with aggregates (LGPD-aware)
export const listStudyRespondents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const study = await assertStudyOwner(supabase, data.study_id, userId);

    const { data: qCount } = await supabase
      .from("questions")
      .select("id", { count: "exact" })
      .eq("study_id", data.study_id);
    const totalQuestions = qCount?.length ?? 0;

    const { data: interviews } = await supabase
      .from("interviews")
      .select("id, respondent_id, status, started_at, finished_at")
      .eq("study_id", data.study_id)
      .order("started_at", { ascending: false });
    const ivs = interviews ?? [];
    const ivIds = ivs.map((i) => i.id);
    const userIds = Array.from(
      new Set(ivs.map((i) => i.respondent_id).filter((x): x is string => !!x)),
    );

    // Profiles dos respondentes: cross-usuário (RLS de profiles é dono-ou-admin)
    // — service-role de propósito, como o e-mail logo abaixo.
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, created_at").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; created_at: string }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Emails — admin only
    const emailMap = new Map<string, string>();
    for (const uid of userIds) {
      const email = await adminGetUserEmail(uid);
      if (email) emailMap.set(uid, email);
    }

    // Answers aggregates
    const { data: ans } = ivIds.length
      ? await supabase
          .from("answers")
          .select("interview_id, status, quality_score, is_followup")
          .in("interview_id", ivIds)
      : {
          data: [] as {
            interview_id: string;
            status: string;
            quality_score: number | null;
            is_followup: boolean;
          }[],
        };
    const ansByIv: Record<string, { ready: number; total: number; scores: number[] }> = {};
    for (const a of ans ?? []) {
      const row = (ansByIv[a.interview_id] ??= { ready: 0, total: 0, scores: [] });
      // Count only non-followup answers towards "answered / total questions"
      if (!a.is_followup) row.total += 1;
      if (a.status === "ready") row.ready += a.is_followup ? 0 : 1;
      if (typeof a.quality_score === "number") row.scores.push(a.quality_score);
    }

    // Consents
    const { data: consents } = ivIds.length
      ? await supabase
          .from("consents")
          .select("interview_id, consent_version, accepted_at")
          .in("interview_id", ivIds)
      : { data: [] as { interview_id: string; consent_version: string; accepted_at: string }[] };
    const consentMap = new Map((consents ?? []).map((c) => [c.interview_id, c]));

    return {
      study: { id: study.id, title: study.title, total_questions: totalQuestions },
      respondents: ivs.map((iv) => {
        const profile = iv.respondent_id ? profileMap.get(iv.respondent_id) : null;
        const agg = ansByIv[iv.id];
        const scores = agg?.scores ?? [];
        const avg = scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        const consent = consentMap.get(iv.id);
        return {
          interview_id: iv.id,
          respondent_id: iv.respondent_id,
          full_name: profile?.full_name ?? null,
          email: iv.respondent_id ? (emailMap.get(iv.respondent_id) ?? null) : null,
          signup_at: profile?.created_at ?? null,
          status: iv.status,
          started_at: iv.started_at,
          finished_at: iv.finished_at,
          answered_questions: agg?.ready ?? 0,
          total_questions: totalQuestions,
          avg_quality: avg,
          consent_version: consent?.consent_version ?? null,
          consent_accepted_at: consent?.accepted_at ?? null,
        };
      }),
    };
  });

// Researcher or respondent: full export of an interview (LGPD)
export const exportInterviewRawData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = (await supabase
      .from("interviews")
      .select(
        "id, study_id, respondent_id, status, started_at, finished_at, studies:study_id(id, title, owner_id, business_goal, context, target_audience)",
      )
      .eq("id", data.interview_id)
      .maybeSingle()) as {
      data: {
        id: string;
        study_id: string;
        respondent_id: string;
        status: string;
        started_at: string;
        finished_at: string | null;
        studies: {
          id: string;
          title: string;
          owner_id: string;
          business_goal: string | null;
          context: string | null;
          target_audience: string | null;
        } | null;
      } | null;
    };
    assertRowRespondentOrStudyOwner(iv, userId);
    const isOwner = iv.studies?.owner_id === userId;

    // questions, o profile do respondente e os metadados do estudo ficam em
    // service-role: o export serve os DOIS papéis, e a RLS não dá questions
    // nem studies ao respondente (decisão F-RLS-2), nem o profile alheio ao
    // dono do estudo.
    const [{ data: questions }, { data: answers }, { data: consent }, { data: profile }, study] =
      await Promise.all([
        supabaseAdmin
          .from("questions")
          .select("id, position, text, intent")
          .eq("study_id", iv.study_id)
          .order("position"),
        supabase.from("answers").select("*").eq("interview_id", iv.id).order("created_at"),
        supabase
          .from("consents")
          .select("consent_version, accepted_at, ip_address, user_agent")
          .eq("interview_id", iv.id)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("full_name, created_at")
          .eq("id", iv.respondent_id)
          .maybeSingle(),
        supabaseAdmin
          .from("studies")
          .select("id, title, business_goal, context, target_audience")
          .eq("id", iv.study_id)
          .maybeSingle()
          .then((r) => r.data),
      ]);

    const respondentEmail = await adminGetUserEmail(iv.respondent_id);

    const enrichedAnswers = await Promise.all(
      (answers ?? []).map(async (a) => {
        const path = `${iv.id}/${a.id}.webm`;
        return {
          ...a,
          video_signed_url: await signedVideoUrl(path),
          video_url_expires_in_seconds: 3600,
        };
      }),
    );

    const studyForCaller = isOwner
      ? {
          id: study?.id,
          title: study?.title,
          business_goal: study?.business_goal,
          context: study?.context,
          target_audience: study?.target_audience,
        }
      : { id: study?.id, title: study?.title };

    return {
      exported_at: new Date().toISOString(),
      lgpd_notice:
        "Dados pessoais — uso restrito conforme termo de consentimento aceito pelo entrevistado. URLs de vídeo expiram em 1h.",
      interview: {
        id: iv.id,
        status: iv.status,
        started_at: iv.started_at,
        finished_at: iv.finished_at,
      },
      study: studyForCaller,
      respondent: {
        id: iv.respondent_id,
        full_name: profile?.full_name ?? null,
        email: respondentEmail,
        signup_at: profile?.created_at ?? null,
      },
      consent: consent ?? null,
      questions,
      answers: enrichedAnswers,
    };
  });

// Researcher or respondent: delete all data for a respondent in this interview (LGPD)
export const deleteRespondentData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = (await supabase
      .from("interviews")
      .select("id, respondent_id, study_id, studies:study_id(owner_id)")
      .eq("id", data.interview_id)
      .maybeSingle()) as {
      data: {
        id: string;
        respondent_id: string;
        study_id: string;
        studies: { owner_id: string } | null;
      } | null;
    };
    assertRowRespondentOrStudyOwner(iv, userId);

    // O apagão em si é poder do service-role de propósito: consents é
    // append-only para usuários (não há policy de DELETE — via RLS o apagão
    // deixaria o consentimento órfão) e o storage segue o padrão admin-ops.
    const { data: list } = await supabaseAdmin.storage.from(BUCKET).list(iv.id);
    if (list && list.length > 0) {
      await supabaseAdmin.storage.from(BUCKET).remove(list.map((f) => `${iv.id}/${f.name}`));
    }
    await supabaseAdmin.from("answers").delete().eq("interview_id", iv.id);
    await supabaseAdmin.from("consents").delete().eq("interview_id", iv.id);
    await supabaseAdmin.from("interviews").delete().eq("id", iv.id);
    return { ok: true };
  });

// Re-score a single answer (researcher only, on-demand)
export const rescoreAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ answer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ans } = (await supabase
      .from("answers")
      .select("id, interview_id, interviews:interview_id(study_id, studies:study_id(owner_id))")
      .eq("id", data.answer_id)
      .maybeSingle()) as {
      data: {
        id: string;
        interview_id: string;
        interviews: { study_id: string; studies: { owner_id: string } | null } | null;
      } | null;
    };
    assertRowAnswerStudyOwner(ans, userId);
    await scoreAnswerInternal(data.answer_id);
    const { data: updated } = await supabase
      .from("answers")
      .select("quality_score, quality_reasoning")
      .eq("id", data.answer_id)
      .single();
    return updated;
  });

// Respondent: list own interviews (for /my-privacy)
// Service-role de propósito: o respondente lê as próprias interviews via RLS,
// mas o TÍTULO do estudo (embed de studies) a RLS não dá — e a tela precisa.
export const listMyInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: ivs } = (await supabaseAdmin
      .from("interviews")
      .select("id, study_id, status, started_at, finished_at, studies:study_id(title)")
      .eq("respondent_id", userId)
      .order("started_at", { ascending: false })) as {
      data:
        | {
            id: string;
            study_id: string;
            status: string;
            started_at: string;
            finished_at: string | null;
            studies: { title: string } | null;
          }[]
        | null;
    };
    return {
      interviews: (ivs ?? []).map((i) => ({
        id: i.id,
        study_title: i.studies?.title ?? "",
        status: i.status,
        started_at: i.started_at,
        finished_at: i.finished_at,
      })),
    };
  });
