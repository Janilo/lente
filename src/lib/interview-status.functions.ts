// Aggregated pipeline status for one interview — powers the status panel.
// Authorized for the interview's respondent OR the owning study's owner.
// Split out of interview.functions.ts (F-A1): it is a read-only projection
// consumed by both roles, independent of the runner and the researcher reads.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRowRespondentOrStudyOwner } from "./authz";

export const getInterviewPipelineStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = (await supabase
      .from("interviews")
      .select("id, study_id, status, respondent_id, studies:study_id(owner_id, max_followups)")
      .eq("id", data.interview_id)
      .maybeSingle()) as {
      data: {
        id: string;
        study_id: string;
        status: string;
        respondent_id: string;
        studies: { owner_id: string; max_followups: number } | null;
      } | null;
    };
    // OBS: para o respondente, o embed de studies volta null (RLS não deixa
    // ele ler studies) — o assert cobre isso: respondent_id OU dono via join.
    assertRowRespondentOrStudyOwner(iv, userId);

    // Config do estudo (max_followups) via service-role: o respondente não lê
    // studies pela RLS, mas o painel dele precisa do teto real de follow-ups —
    // mesmo padrão do getNextStep.
    const { data: studyCfg } = await supabaseAdmin
      .from("studies")
      .select("max_followups")
      .eq("id", iv.study_id)
      .maybeSingle();
    const maxFollowups = studyCfg?.max_followups ?? 2;

    const { data: answers } = await supabase
      .from("answers")
      .select(
        "id, question_id, is_followup, status, error_message, transcript, created_at, updated_at",
      )
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
      const maxFu = maxFollowups;
      const allReady = sameQ.every((a) => a.status === "ready");
      if (followups.length >= maxFu) followupState = "exhausted";
      else if (!allReady) followupState = "deciding";
      else {
        // last answer is ready; if a new followup row exists after it → ready
        const newer = ans.find(
          (a) => a.is_followup && new Date(a.created_at) > new Date(last.created_at),
        );
        if (newer) followupState = "ready";
        else if (last.is_followup) followupState = "skipped";
        else followupState = "skipped";
      }
    }

    // Estado da síntese: é conteúdo do dono do estudo (insights/recommendations
    // não têm policy para o respondente), mas o painel dos DOIS papéis mostra
    // o resumo — leitura via service-role de propósito.
    const [{ data: insights }, { data: recs }] = await Promise.all([
      supabaseAdmin
        .from("insights")
        .select("id, created_at")
        .eq("study_id", iv.study_id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("recommendations")
        .select("id, created_at")
        .eq("study_id", iv.study_id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const lastInsight = insights?.[0]?.created_at ?? null;
    const lastRec = recs?.[0]?.created_at ?? null;
    const lastGenerated = [lastInsight, lastRec].filter(Boolean).sort().reverse()[0] ?? null;

    return {
      interview_status: iv.status,
      study_id: iv.study_id,
      answers: counts,
      last_answer: last
        ? {
            id: last.id,
            status: last.status,
            error_message: last.error_message,
            updated_at: last.updated_at,
          }
        : null,
      followup: { state: followupState },
      synthesis: {
        has_insights: (insights?.length ?? 0) > 0,
        has_recommendations: (recs?.length ?? 0) > 0,
        last_generated_at: lastGenerated,
      },
    };
  });
