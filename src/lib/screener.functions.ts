import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TYPES = ["single_choice", "multi_choice", "short_text"] as const;

// Owner: list screener questions for own study (full data including criteria)
export const listScreenerQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase.from("studies").select("id").eq("id", data.study_id).eq("owner_id", userId).maybeSingle();
    if (!owned) throw new Error("Acesso negado.");
    const { data: rows, error } = await supabase
      .from("screener_questions")
      .select("*")
      .eq("study_id", data.study_id)
      .order("position");
    if (error) throw new Error(error.message);
    return { questions: rows ?? [] };
  });

// Owner: upsert a screener question
export const upsertScreenerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      study_id: z.string().uuid(),
      position: z.number().int().min(0),
      text: z.string().trim().min(1).max(1000),
      type: z.enum(TYPES),
      options: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      qualifies: z.boolean().default(false),
      qualifying_options: z.array(z.number().int().min(0).max(19)).max(20).default([]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase.from("studies").select("id").eq("id", data.study_id).eq("owner_id", userId).maybeSingle();
    if (!owned) throw new Error("Acesso negado.");
    const payload = {
      study_id: data.study_id,
      position: data.position,
      text: data.text,
      type: data.type,
      options: data.type === "short_text" ? [] : data.options,
      qualifies: data.qualifies,
      qualifying_options: data.qualifies && data.type !== "short_text" ? data.qualifying_options : [],
    };
    if (data.id) {
      const { error } = await supabase.from("screener_questions").update(payload).eq("id", data.id).eq("study_id", data.study_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("screener_questions").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteScreenerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase.from("studies").select("id").eq("id", data.study_id).eq("owner_id", userId).maybeSingle();
    if (!owned) throw new Error("Acesso negado.");
    const { error } = await supabase.from("screener_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: get screener questions for a published study (omits qualifying criteria)
export const getPublicScreener = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { data: study } = await supabaseAdmin
      .from("studies").select("id, status").eq("public_slug", data.slug).maybeSingle();
    if (!study || study.status !== "published") throw new Error("Estudo indisponível.");
    const { data: rows } = await supabaseAdmin
      .from("screener_questions")
      .select("id, position, text, type, options")
      .eq("study_id", study.id)
      .order("position");
    return { study_id: study.id, questions: rows ?? [] };
  });

// Respondent: check existing submission for current user
export const getMyScreenerSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: study } = await supabaseAdmin
      .from("studies").select("id").eq("public_slug", data.slug).maybeSingle();
    if (!study) return { submission: null };
    const { data: sub } = await supabaseAdmin
      .from("screener_submissions")
      .select("id, qualified, created_at")
      .eq("study_id", study.id)
      .eq("user_id", userId)
      .maybeSingle();
    return { submission: sub ?? null };
  });

// Respondent: submit screener answers
export const submitScreener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      slug: z.string().min(1).max(100),
      responses: z.array(z.object({
        question_id: z.string().uuid(),
        answer: z.union([z.string().max(1000), z.array(z.number().int().min(0).max(19)).max(20)]),
      })).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: study } = await supabaseAdmin
      .from("studies").select("id, status").eq("public_slug", data.slug).maybeSingle();
    if (!study || study.status !== "published") throw new Error("Estudo indisponível.");

    const { data: questions } = await supabaseAdmin
      .from("screener_questions")
      .select("id, type, qualifies, qualifying_options, options")
      .eq("study_id", study.id);
    const qMap = new Map((questions ?? []).map((q) => [q.id, q]));

    let qualified = true;
    for (const q of questions ?? []) {
      const r = data.responses.find((x) => x.question_id === q.id);
      if (!r) {
        // missing answer to qualifier -> disqualified; missing to non-qualifier -> still required
        qualified = false;
        continue;
      }
      if (q.qualifies) {
        if (q.type === "short_text") {
          // text qualifiers: just presence is enough (free-form)
          if (typeof r.answer !== "string" || r.answer.trim().length === 0) qualified = false;
        } else {
          const picked = Array.isArray(r.answer) ? r.answer : [];
          const qualifying = (q.qualifying_options as unknown as number[]) ?? [];
          if (picked.length === 0) qualified = false;
          else if (!picked.every((idx) => qualifying.includes(idx))) qualified = false;
        }
      }
    }

    const { data: sub, error } = await supabaseAdmin
      .from("screener_submissions")
      .upsert({
        study_id: study.id,
        user_id: userId,
        responses: data.responses,
        qualified,
      }, { onConflict: "study_id,user_id" })
      .select("id, qualified")
      .single();
    if (error) throw new Error(error.message);
    return { submission: sub, total_questions: (questions ?? []).length };
  });
