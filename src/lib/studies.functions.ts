import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_EMAIL } from "./config";

export const listMyStudies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("studies")
      .select("id, title, status, business_goal, created_at, public_slug")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { studies: data ?? [] };
  });

export const createStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        business_goal: z.string().trim().max(2000).optional().default(""),
        context: z.string().trim().max(5000).optional().default(""),
        target_audience: z.string().trim().max(2000).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: study, error } = await supabase
      .from("studies")
      .insert({
        owner_id: userId,
        title: data.title,
        business_goal: data.business_goal || null,
        context: data.context || null,
        target_audience: data.target_audience || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { study };
  });

export const getStudy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: study, error } = await supabase
      .from("studies")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("study_id", data.id)
      .order("position");
    return { study, questions: questions ?? [] };
  });

export const updateStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        business_goal: z.string().trim().max(2000).optional().default(""),
        context: z.string().trim().max(5000).optional().default(""),
        target_audience: z.string().trim().max(2000).optional().default(""),
        max_followups: z.number().int().min(0).max(5),
        status: z.enum(["draft", "published", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    if (data.status === "published") {
      const email = (claims as { email?: string } | undefined)?.email?.toLowerCase();
      const isAdmin = email === ADMIN_EMAIL;
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("can_publish")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.can_publish)
          throw new Error("Sem permissão para publicar. Solicite ao administrador.");
      }
    }
    const { error } = await supabase
      .from("studies")
      .update({
        title: data.title,
        business_goal: data.business_goal || null,
        context: data.context || null,
        target_audience: data.target_audience || null,
        max_followups: data.max_followups,
        status: data.status,
      })
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        study_id: z.string().uuid(),
        position: z.number().int().min(0),
        text: z.string().trim().min(1).max(1000),
        intent: z.string().trim().max(1000).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned, error: ownErr } = await supabase
      .from("studies")
      .select("id")
      .eq("id", data.study_id)
      .eq("owner_id", userId)
      .single();
    if (ownErr || !owned) throw new Error("Not allowed");
    if (data.id) {
      const { error } = await supabase
        .from("questions")
        .update({
          position: data.position,
          text: data.text,
          intent: data.intent || null,
        })
        .eq("id", data.id)
        .eq("study_id", data.study_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: q, error } = await supabase
      .from("questions")
      .insert({
        study_id: data.study_id,
        position: data.position,
        text: data.text,
        intent: data.intent || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: q.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), study_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("studies")
      .select("id")
      .eq("id", data.study_id)
      .eq("owner_id", userId)
      .single();
    if (!owned) throw new Error("Not allowed");
    const { error } = await supabase.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
