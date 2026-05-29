import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "janilo@pereirasaraiva.com";

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

// --------- List studies eligible for recruitment ---------

export const adminListStudiesForRecruitment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data, error } = await supabaseAdmin
      .from("studies")
      .select("id, title, status, public_slug, created_at")
      .in("status", ["draft", "published"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { studies: data ?? [] };
  });

// --------- Recruitment pool query (pool + invitation status per study) ---------

const recruitmentFiltersSchema = z.object({
  study_id: z.string().uuid(),
  search: z.string().trim().max(200).optional().default(""),
  tagValueIds: z.array(z.string().uuid()).max(50).optional().default([]),
  excludeAlreadyInvited: z.boolean().optional().default(false),
});

export const adminListRecruitmentPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recruitmentFiltersSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });

    // Existing invitations for this study
    const invRes = await supabaseAdmin
      .from("study_invitations")
      .select("respondent_id, status, channel, sent_at")
      .eq("study_id", data.study_id);
    if (invRes.error) throw new Error(invRes.error.message);
    const invitedMap = new Map(invRes.data?.map((i) => [i.respondent_id, i]) ?? []);

    // Tag filter (AND semantics)
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
      if (allowedIds.size === 0) return { respondents: [], invited_count: invitedMap.size };
    }

    let q = supabaseAdmin
      .from("respondent_profile")
      .select("id, user_id, full_name, email, phone, city, state, occupation, company, created_at")
      .eq("active", true);
    if (allowedIds) q = q.in("id", Array.from(allowedIds));
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},occupation.ilike.${s},company.ilike.${s}`);
    }
    const { data: profiles, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    if (!profiles) return { respondents: [], invited_count: invitedMap.size };

    const respondentIds = profiles.map((p) => p.id);
    const [statsRes, tagsRes] = await Promise.all([
      supabaseAdmin
        .from("respondent_stats")
        .select("respondent_id, studies_count, completed_count, avg_quality_score, last_participation_at")
        .in("respondent_id", respondentIds),
      supabaseAdmin
        .from("respondent_tags")
        .select("respondent_id, tag_values(label, tag_dimensions(label))")
        .in("respondent_id", respondentIds),
    ]);
    const statsMap = new Map((statsRes.data ?? []).map((s) => [s.respondent_id, s]));
    const tagsByResp = new Map<string, { label: string; dimension: string }[]>();
    for (const t of (tagsRes.data ?? []) as Array<{
      respondent_id: string;
      tag_values: { label: string; tag_dimensions: { label: string } } | null;
    }>) {
      if (!t.tag_values) continue;
      const arr = tagsByResp.get(t.respondent_id) ?? [];
      arr.push({ label: t.tag_values.label, dimension: t.tag_values.tag_dimensions?.label ?? "" });
      tagsByResp.set(t.respondent_id, arr);
    }

    const enriched = profiles.map((p) => {
      const s = statsMap.get(p.id);
      const inv = invitedMap.get(p.id);
      return {
        ...p,
        studies_count: Number(s?.studies_count ?? 0),
        completed_count: Number(s?.completed_count ?? 0),
        avg_quality_score: s?.avg_quality_score ?? null,
        last_participation_at: s?.last_participation_at ?? null,
        tags: tagsByResp.get(p.id) ?? [],
        invitation: inv
          ? { status: inv.status, channel: inv.channel, sent_at: inv.sent_at }
          : null,
      };
    });

    const filtered = data.excludeAlreadyInvited ? enriched.filter((r) => !r.invitation) : enriched;
    return { respondents: filtered, invited_count: invitedMap.size };
  });

// --------- Bulk create invitations ---------

const bulkInviteSchema = z.object({
  study_id: z.string().uuid(),
  respondent_ids: z.array(z.string().uuid()).min(1).max(200),
  channel: z.enum(["manual", "whatsapp", "email", "link"]).default("manual"),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const adminCreateInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bulkInviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });

    const rows = data.respondent_ids.map((rid) => ({
      study_id: data.study_id,
      respondent_id: rid,
      invited_by: context.userId,
      channel: data.channel,
      status: data.channel === "manual" || data.channel === "link" ? "sent" : "queued",
      message: data.message?.trim() || null,
      sent_at: new Date().toISOString(),
    }));

    // Upsert on (study_id, respondent_id) — re-inviting refreshes timestamps
    const { error, data: inserted } = await supabaseAdmin
      .from("study_invitations")
      .upsert(rows, { onConflict: "study_id,respondent_id" })
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, created: inserted?.length ?? 0 };
  });

export const adminUpdateInvitationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["queued", "sent", "failed", "accepted", "declined"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("study_invitations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
