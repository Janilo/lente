import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { ADMIN_EMAIL } from "./config";

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const [studies, profiles, interviews, clicks] = await Promise.all([
      supabaseAdmin.from("studies").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("interviews").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("cta_click_events").select("id", { count: "exact", head: true }),
    ]);
    return {
      totalStudies: studies.count ?? 0,
      totalUsers: profiles.count ?? 0,
      totalInterviews: interviews.count ?? 0,
      totalCtaClicks: clicks.count ?? 0,
    };
  });

export const adminListStudies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data: studies, error } = await supabaseAdmin
      .from("studies")
      .select("id, title, status, owner_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((studies ?? []).map((s) => s.owner_id)));
    const { data: profiles } = ownerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const emailMap = new Map<string, string>();
    for (const uid of ownerIds) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailMap.set(uid, u.user.email);
      } catch { /* ignore */ }
    }

    const studyIds = (studies ?? []).map((s) => s.id);
    const { data: ivs } = studyIds.length
      ? await supabaseAdmin.from("interviews").select("study_id").in("study_id", studyIds)
      : { data: [] as { study_id: string }[] };
    const ivCount = new Map<string, number>();
    for (const i of ivs ?? []) ivCount.set(i.study_id, (ivCount.get(i.study_id) ?? 0) + 1);

    return {
      studies: (studies ?? []).map((s) => ({
        ...s,
        owner_name: nameMap.get(s.owner_id) ?? null,
        owner_email: emailMap.get(s.owner_id) ?? null,
        interviews_count: ivCount.get(s.id) ?? 0,
      })),
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, can_publish, created_at, city, state, age_range, occupation, industry, research_interests")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    const emailMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
        if (u?.user?.email) emailMap.set(p.id, u.user.email);
      } catch { /* ignore */ }
    }

    return {
      users: (profiles ?? []).map((p) => ({
        ...p,
        email: emailMap.get(p.id) ?? null,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

const respondentFiltersSchema = z.object({
  name: z.string().trim().max(200).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  age_range: z.string().trim().max(50).optional().default(""),
  occupation: z.string().trim().max(200).optional().default(""),
  industry: z.string().trim().max(200).optional().default(""),
  research_interest: z.string().trim().max(200).optional().default(""),
});

export const adminListRespondents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => respondentFiltersSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });

    // Only users that have at least one interview = respondents
    const { data: ivs } = await supabaseAdmin
      .from("interviews")
      .select("respondent_id");
    const respondentIds = Array.from(new Set((ivs ?? []).map((i) => i.respondent_id).filter((x): x is string => !!x)));
    if (respondentIds.length === 0) return { respondents: [] };

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, city, state, age_range, occupation, industry, research_interests, created_at")
      .in("id", respondentIds);

    if (data.name) q = q.ilike("full_name", `%${data.name}%`);
    if (data.city) q = q.ilike("city", `%${data.city}%`);
    if (data.state) q = q.ilike("state", `%${data.state}%`);
    if (data.age_range) q = q.eq("age_range", data.age_range);
    if (data.occupation) q = q.ilike("occupation", `%${data.occupation}%`);
    if (data.industry) q = q.ilike("industry", `%${data.industry}%`);
    if (data.research_interest) q = q.contains("research_interests", [data.research_interest]);

    const { data: profiles, error } = await q.order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);

    const ivCount = new Map<string, number>();
    for (const i of ivs ?? []) { if (i.respondent_id) ivCount.set(i.respondent_id, (ivCount.get(i.respondent_id) ?? 0) + 1); }

    const emailMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
        if (u?.user?.email) emailMap.set(p.id, u.user.email);
      } catch { /* ignore */ }
    }

    let filtered = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      interviews_count: ivCount.get(p.id) ?? 0,
    }));

    if (data.email) {
      const needle = data.email.toLowerCase();
      filtered = filtered.filter((p) => (p.email ?? "").toLowerCase().includes(needle));
    }

    return { respondents: filtered };
  });

export const adminListCtaClicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data, error } = await supabaseAdmin
      .from("cta_click_events")
      .select("id, cta_id, href, referrer, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { clicks: data ?? [] };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data } = await supabaseAdmin.from("app_settings").select("stt_provider").eq("id", true).maybeSingle();
    return { stt_provider: (data?.stt_provider ?? "elevenlabs") as "elevenlabs" | "assemblyai" };
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ stt_provider: z.enum(["elevenlabs", "assemblyai"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ id: true, stt_provider: data.stt_provider, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetCanPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), can_publish: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ can_publish: data.can_publish })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public-ish helper for the current user's publishing permission (used by UI gate)
export const getMyPublishPermission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = ((claims as { email?: string })?.email ?? "").toLowerCase();
    if (email === ADMIN_EMAIL) return { can_publish: true, is_admin: true };
    const { data } = await supabaseAdmin.from("profiles").select("can_publish").eq("id", userId).maybeSingle();
    return { can_publish: !!data?.can_publish, is_admin: false };
  });
