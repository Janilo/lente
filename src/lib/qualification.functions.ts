import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getQualificationData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const [dims, vals, profileRes] = await Promise.all([
      supabaseAdmin.from("tag_dimensions").select("*").order("position"),
      supabaseAdmin.from("tag_values").select("*").order("position"),
      supabaseAdmin.from("respondent_profile").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (dims.error) throw new Error(dims.error.message);
    if (vals.error) throw new Error(vals.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);

    const byDim = new Map<string, typeof vals.data>();
    for (const v of vals.data ?? []) {
      const arr = byDim.get(v.dimension_id) ?? [];
      arr.push(v);
      byDim.set(v.dimension_id, arr);
    }

    let currentTagValueIds: string[] = [];
    if (profileRes.data) {
      const { data: tags, error } = await supabaseAdmin
        .from("respondent_tags")
        .select("tag_value_id")
        .eq("respondent_id", profileRes.data.id);
      if (error) throw new Error(error.message);
      currentTagValueIds = (tags ?? []).map((t) => t.tag_value_id);
    }

    return {
      dimensions: (dims.data ?? []).map((d) => ({
        ...d,
        values: byDim.get(d.id) ?? [],
      })),
      profile: profileRes.data,
      currentTagValueIds,
    };
  });

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).optional().nullable(),
  occupation: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  age_range: z.string().trim().max(40).optional().nullable(),
  linkedin_url: z.string().trim().url().max(300).optional().nullable().or(z.literal("")),
  consent_research: z.boolean().optional().default(true),
});

export const saveQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        profile: profileSchema,
        // one value per dimension (uuid), filtered by caller; we re-validate count
        tag_value_ids: z.array(z.string().uuid()).max(20).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;

    // 1. Upsert respondent_profile
    const existing = await supabaseAdmin
      .from("respondent_profile")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const profilePayload = {
      user_id: userId,
      email,
      full_name: data.profile.full_name,
      company: data.profile.company || null,
      occupation: data.profile.occupation || null,
      city: data.profile.city || null,
      state: data.profile.state || null,
      age_range: data.profile.age_range || null,
      linkedin_url: data.profile.linkedin_url || null,
      consent_research: data.profile.consent_research ?? true,
      source: existing.data ? undefined : "self_signup",
    };

    let respondentId: string;
    if (existing.data) {
      const { error } = await supabaseAdmin
        .from("respondent_profile")
        .update(profilePayload)
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
      respondentId = existing.data.id;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("respondent_profile")
        .insert(profilePayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      respondentId = inserted.id;
    }

    // 2. Validate tag_value_ids actually exist
    let validIds: string[] = [];
    if (data.tag_value_ids.length > 0) {
      const { data: valid, error } = await supabaseAdmin
        .from("tag_values")
        .select("id")
        .in("id", data.tag_value_ids);
      if (error) throw new Error(error.message);
      validIds = (valid ?? []).map((v) => v.id);
    }

    // 3. Replace tags: delete existing self-assigned, then insert new
    const delRes = await supabaseAdmin
      .from("respondent_tags")
      .delete()
      .eq("respondent_id", respondentId);
    if (delRes.error) throw new Error(delRes.error.message);

    if (validIds.length > 0) {
      const rows = validIds.map((tag_value_id) => ({
        respondent_id: respondentId,
        tag_value_id,
        assigned_by: userId,
      }));
      const { error } = await supabaseAdmin.from("respondent_tags").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true, respondent_id: respondentId, tags_count: validIds.length };
  });
