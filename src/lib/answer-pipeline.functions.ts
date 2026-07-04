// The respondent's answer pipeline: create the answer row (returns the upload
// path) and, after the client uploads the video, transcribe + score + advance
// the interview. Split out of interview.functions.ts (F-A1); the lifecycle /
// next-step orchestration stays there (this file calls computeNextStep).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertInterviewRespondent } from "./authz";
import { scoreAnswerInternal } from "./answer-quality";
import { enrichInterviewInternal } from "./interview-enrichment.functions";
import { computeNextStep } from "./interview.functions";
import { transcribeAudio } from "./stt.server";

const BUCKET = "interview-videos";

// Create an answer row (uploading), returns ID + storage path
export const createAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        interview_id: z.string().uuid(),
        question_id: z.string().uuid(),
        question_text: z.string().min(1).max(2000),
        is_followup: z.boolean(),
        parent_answer_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertInterviewRespondent(supabase, data.interview_id, userId);
    const { data: ans, error } = await supabase
      .from("answers")
      .insert({
        interview_id: data.interview_id,
        question_id: data.question_id,
        question_text: data.question_text,
        is_followup: data.is_followup,
        parent_answer_id: data.parent_answer_id ?? null,
        status: "uploading",
      })
      .select("id")
      .single();
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
    const { data: ans } = (await supabase
      .from("answers")
      .select("id, interview_id, status, interviews:interview_id(respondent_id)")
      .eq("id", data.answer_id)
      .maybeSingle()) as {
      data: {
        id: string;
        interview_id: string;
        status: string;
        interviews: { respondent_id: string } | null;
      } | null;
    };
    if (!ans || ans.interviews?.respondent_id !== userId) throw new Error("Acesso negado.");

    await supabaseAdmin.from("answers").update({ status: "transcribing" }).eq("id", ans.id);

    const path = `${ans.interview_id}/${ans.id}.webm`;
    const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (dlErr || !file) {
      await supabaseAdmin
        .from("answers")
        .update({ status: "failed", error_message: dlErr?.message ?? "Falha ao baixar vídeo" })
        .eq("id", ans.id);
      throw new Error("Falha ao recuperar gravação.");
    }

    try {
      const { transcript, words } = await transcribeAudio(file);

      const cleaned = (transcript ?? "").trim();
      if (cleaned.length < 2) {
        await supabaseAdmin
          .from("answers")
          .update({
            status: "failed",
            error_message: "Nenhuma fala detectada no vídeo.",
          })
          .eq("id", ans.id);
        const next = await computeNextStep(ans.interview_id);
        return { next, empty: true };
      }

      await supabaseAdmin
        .from("answers")
        .update({
          status: "ready",
          transcript: cleaned,
          words_json: words as any,
        })
        .eq("id", ans.id);

      // Best-effort auto quality scoring (does not block the pipeline).
      try {
        await scoreAnswerInternal(ans.id, cleaned);
      } catch (err) {
        console.error("quality score failed", err);
      }
    } catch (e) {
      await supabaseAdmin
        .from("answers")
        .update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Erro desconhecido",
        })
        .eq("id", ans.id);
      throw e;
    }

    const next = await computeNextStep(ans.interview_id);
    if (next.type === "done") {
      await supabaseAdmin
        .from("interviews")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", ans.interview_id);
      try {
        await enrichInterviewInternal(ans.interview_id);
      } catch (e) {
        console.error("enrich-on-complete failed", e);
      }
    }
    return { next, empty: false };
  });
