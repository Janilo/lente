import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { ADMIN_EMAIL } from "./config";

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

const slugRegex = /^[a-z0-9_-]+$/;

// ---------- Tag dimensions + values ----------

export const adminListTagDimensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const [dims, vals] = await Promise.all([
      supabaseAdmin.from("tag_dimensions").select("*").order("position"),
      supabaseAdmin.from("tag_values").select("*").order("position"),
    ]);
    if (dims.error) throw new Error(dims.error.message);
    if (vals.error) throw new Error(vals.error.message);
    const byDim = new Map<string, typeof vals.data>();
    for (const v of vals.data ?? []) {
      const arr = byDim.get(v.dimension_id) ?? [];
      arr.push(v);
      byDim.set(v.dimension_id, arr);
    }
    return {
      dimensions: (dims.data ?? []).map((d) => ({
        ...d,
        values: byDim.get(d.id) ?? [],
      })),
    };
  });

export const adminCreateTagValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dimension_id: z.string().uuid(),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(slugRegex, "slug inválido (use a-z, 0-9, _, -)"),
        label: z.string().trim().min(1).max(120),
        position: z.number().int().min(0).max(9999).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin.from("tag_values").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateTagValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
        position: z.number().int().min(0).max(9999).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("tag_values")
      .update({ label: data.label, position: data.position ?? 0 })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTagValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin.from("tag_values").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pool ----------

const poolFiltersSchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  tagValueIds: z.array(z.string().uuid()).max(50).optional().default([]),
  onlyActive: z.boolean().optional().default(true),
});

export const adminListRespondentPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => poolFiltersSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });

    // Filter by tags first (AND semantics: must have ALL selected tags)
    let allowedIds: Set<string> | null = null;
    if (data.tagValueIds.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("respondent_tags")
        .select("respondent_id, tag_value_id")
        .in("tag_value_id", data.tagValueIds);
      if (error) throw new Error(error.message);
      const count = new Map<string, number>();
      for (const r of rows ?? []) count.set(r.respondent_id, (count.get(r.respondent_id) ?? 0) + 1);
      allowedIds = new Set(
        Array.from(count.entries())
          .filter(([, c]) => c === data.tagValueIds.length)
          .map(([id]) => id),
      );
      if (allowedIds.size === 0) return { respondents: [] };
    }

    let q = supabaseAdmin
      .from("respondent_profile")
      .select(
        "id, user_id, full_name, email, phone, city, state, age_range, occupation, company, source, active, created_at",
      );
    if (data.onlyActive) q = q.eq("active", true);
    if (allowedIds) q = q.in("id", Array.from(allowedIds));
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},occupation.ilike.${s},company.ilike.${s}`);
    }
    const { data: profiles, error } = await q.order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    if (!profiles || profiles.length === 0) return { respondents: [] };

    const respondentIds = profiles.map((p) => p.id);
    const userIds = profiles.map((p) => p.user_id);

    const [statsRes, tagsRes, emailFallback] = await Promise.all([
      supabaseAdmin
        .from("respondent_stats")
        .select(
          "respondent_id, studies_count, completed_count, interviews_count, last_participation_at, avg_quality_score",
        )
        .in("respondent_id", respondentIds),
      supabaseAdmin
        .from("respondent_tags")
        .select(
          "respondent_id, tag_value_id, tag_values(label, dimension_id, tag_dimensions(label))",
        )
        .in("respondent_id", respondentIds),
      // for respondents without an email column, look up via auth
      Promise.all(
        profiles
          .filter((p) => !p.email)
          .map(async (p) => {
            try {
              const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
              return [p.id, u?.user?.email ?? null] as const;
            } catch {
              return [p.id, null] as const;
            }
          }),
      ),
    ]);

    const statsMap = new Map((statsRes.data ?? []).map((s) => [s.respondent_id, s]));
    const tagsByResp = new Map<
      string,
      { tag_value_id: string; label: string; dimension: string }[]
    >();
    for (const t of (tagsRes.data ?? []) as Array<{
      respondent_id: string;
      tag_value_id: string;
      tag_values: { label: string; tag_dimensions: { label: string } } | null;
    }>) {
      if (!t.tag_values) continue;
      const arr = tagsByResp.get(t.respondent_id) ?? [];
      arr.push({
        tag_value_id: t.tag_value_id,
        label: t.tag_values.label,
        dimension: t.tag_values.tag_dimensions?.label ?? "",
      });
      tagsByResp.set(t.respondent_id, arr);
    }
    const emailFb = new Map(emailFallback);

    return {
      respondents: profiles.map((p) => {
        const s = statsMap.get(p.id);
        return {
          ...p,
          email: p.email ?? emailFb.get(p.id) ?? null,
          studies_count: Number(s?.studies_count ?? 0),
          completed_count: Number(s?.completed_count ?? 0),
          interviews_count: Number(s?.interviews_count ?? 0),
          last_participation_at: s?.last_participation_at ?? null,
          avg_quality_score: s?.avg_quality_score ?? null,
          tags: tagsByResp.get(p.id) ?? [],
        };
      }),
      total: profiles.length,
    };
  });

export const adminAssignTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        respondent_id: z.string().uuid(),
        tag_value_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("respondent_tags")
      .upsert({ ...data, assigned_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUnassignTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        respondent_id: z.string().uuid(),
        tag_value_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("respondent_tags")
      .delete()
      .eq("respondent_id", data.respondent_id)
      .eq("tag_value_id", data.tag_value_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
