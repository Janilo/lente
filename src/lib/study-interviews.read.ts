// Researcher-facing reads over a study's interviews: list, detail (with signed
// video URLs) and the structured table with AI insights. Split out of
// interview.functions.ts (F-A1) — the respondent runner lives there; this file
// is only the study owner's view.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertStudyOwner } from "./authz";
import { signedVideoUrl } from "./admin-ops.server";

// Researcher: list interviews for a study
export const listStudyInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const study = await assertStudyOwner(supabase, data.study_id, userId);
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
        .from("answers")
        .select("interview_id, status")
        .in("interview_id", ids);
      counts = (ans ?? []).reduce(
        (acc, a) => {
          const c = acc[a.interview_id] ?? { total: 0, ready: 0 };
          c.total += 1;
          if (a.status === "ready") c.ready += 1;
          acc[a.interview_id] = c;
          return acc;
        },
        {} as Record<string, { total: number; ready: number }>,
      );
    }
    return {
      study: { id: study.id, title: study.title },
      interviews: (interviews ?? []).map((i) => ({
        ...i,
        answer_count: counts[i.id]?.total ?? 0,
        ready_count: counts[i.id]?.ready ?? 0,
      })),
    };
  });

// Researcher: full interview detail (answers + signed video urls)
export const getInterviewDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv, error: ivErr } = (await supabase
      .from("interviews")
      .select(
        "id, study_id, status, started_at, finished_at, respondent_id, studies:study_id(id, title, owner_id)",
      )
      .eq("id", data.interview_id)
      .maybeSingle()) as {
      data: {
        id: string;
        study_id: string;
        status: string;
        started_at: string;
        finished_at: string | null;
        respondent_id: string;
        studies: { id: string; title: string; owner_id: string } | null;
      } | null;
      error: { message: string } | null;
    };
    if (ivErr) throw new Error(ivErr.message);
    if (!iv || iv.studies?.owner_id !== userId) throw new Error("Acesso negado.");

    const { data: answers } = await supabaseAdmin
      .from("answers")
      .select(
        "id, question_id, question_text, transcript, is_followup, parent_answer_id, status, error_message, duration_seconds, created_at, video_path, start_seconds, end_seconds",
      )
      .eq("interview_id", data.interview_id)
      .order("created_at", { ascending: true });

    const enriched = await Promise.all(
      (answers ?? []).map(async (a) => {
        const path = a.video_path ?? `${data.interview_id}/${a.id}.webm`;
        return { ...a, video_url: await signedVideoUrl(path) };
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

// Researcher: tabela estruturada das entrevistas do estudo (com insights por IA)
export const listStudyInterviewsTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const study = await assertStudyOwner(supabaseAdmin, data.study_id, userId);

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, text, position")
      .eq("study_id", data.study_id)
      .order("position");

    const { data: interviews } = await supabaseAdmin
      .from("interviews")
      .select("id, status, started_at, finished_at, respondent_id, source, external_respondent")
      .eq("study_id", data.study_id)
      .order("started_at", { ascending: false });

    const ids = (interviews ?? []).map((i) => i.id);
    const respondentIds = Array.from(
      new Set((interviews ?? []).map((i) => i.respondent_id).filter((x): x is string => !!x)),
    );

    const [{ data: answers }, { data: insights }, { data: profiles }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("answers")
            .select(
              "interview_id, question_id, status, transcript, duration_seconds, quality_score",
            )
            .in("interview_id", ids)
        : Promise.resolve({
            data: [] as {
              interview_id: string;
              question_id: string | null;
              status: string;
              transcript: string | null;
              duration_seconds: number | null;
              quality_score: number | null;
            }[],
          }),
      ids.length
        ? supabaseAdmin
            .from("interview_insights")
            .select(
              "interview_id, quality, segments, tags, bullet_summary, tagline, answer_summaries",
            )
            .in("interview_id", ids)
        : Promise.resolve({
            data: [] as {
              interview_id: string;
              quality: string | null;
              segments: string[];
              tags: string[];
              bullet_summary: string[];
              tagline: string | null;
              answer_summaries: { question_id: string; summary: string }[];
            }[],
          }),
      respondentIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name, city, state")
            .in("id", respondentIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              full_name: string | null;
              city: string | null;
              state: string | null;
            }[],
          }),
    ]);

    const ansByIv = new Map<string, typeof answers>();
    for (const a of answers ?? []) {
      const list = ansByIv.get(a.interview_id) ?? [];
      list.push(a);
      ansByIv.set(a.interview_id, list);
    }
    const insightsByIv = new Map((insights ?? []).map((x) => [x.interview_id, x]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = (interviews ?? []).map((iv, idx) => {
      const ans = ansByIv.get(iv.id) ?? [];
      const totalDuration = ans.reduce((s, a) => s + (a.duration_seconds ?? 0), 0);
      const fallbackDuration =
        iv.finished_at && iv.started_at
          ? (new Date(iv.finished_at).getTime() - new Date(iv.started_at).getTime()) / 1000
          : 0;
      const activeSec = Math.round(totalDuration > 0 ? totalDuration : fallbackDuration);

      const qualityScores = ans
        .map((a) => a.quality_score)
        .filter((x): x is number => typeof x === "number");
      const avgQuality = qualityScores.length
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : null;

      const insight = insightsByIv.get(iv.id);
      const profile = iv.respondent_id ? profileById.get(iv.respondent_id) : null;
      const ext = (iv.external_respondent as Record<string, unknown> | null) ?? null;

      return {
        id: iv.id,
        sequence: (interviews?.length ?? 0) - idx,
        started_at: iv.started_at,
        finished_at: iv.finished_at,
        status: iv.status,
        source: iv.source,
        active_seconds: activeSec,
        avg_quality_score: avgQuality,
        respondent_name: (ext?.full_name as string | undefined) ?? profile?.full_name ?? null,
        respondent_city: (ext?.city as string | undefined) ?? profile?.city ?? null,
        respondent_state: (ext?.state as string | undefined) ?? profile?.state ?? null,
        insights: insight ?? null,
      };
    });

    return {
      study: { id: study.id, title: study.title },
      questions: questions ?? [],
      rows,
    };
  });
