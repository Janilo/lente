import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "janilo@pereirasaraiva.com";

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

export const adminGetRespondentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("respondent_profile")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Respondente não encontrado.");

    const [tagsRes, invitesRes, interviewsRes, compRes] = await Promise.all([
      supabaseAdmin
        .from("respondent_tags")
        .select("tag_value_id, assigned_at, tag_values(label, tag_dimensions(label))")
        .eq("respondent_id", data.id),
      supabaseAdmin
        .from("study_invitations")
        .select("id, study_id, channel, status, sent_at, created_at, studies(title)")
        .eq("respondent_id", data.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("interviews")
        .select("id, study_id, status, started_at, finished_at, source, studies(title)")
        .eq("respondent_id", profile.user_id)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("compensation_log")
        .select("id, amount, currency, method, status, paid_at, created_at, study_id, studies(title)")
        .eq("respondent_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    if (tagsRes.error) throw new Error(tagsRes.error.message);
    if (invitesRes.error) throw new Error(invitesRes.error.message);
    if (interviewsRes.error) throw new Error(interviewsRes.error.message);
    if (compRes.error) throw new Error(compRes.error.message);

    // Quality scores per interview (from answers)
    const interviewIds = (interviewsRes.data ?? []).map((i: any) => i.id);
    let qualityByInterview = new Map<string, { avg: number; count: number }>();
    if (interviewIds.length > 0) {
      const { data: answers, error: aErr } = await supabaseAdmin
        .from("answers")
        .select("interview_id, quality_score")
        .in("interview_id", interviewIds);
      if (aErr) throw new Error(aErr.message);
      const acc = new Map<string, { sum: number; n: number }>();
      for (const a of answers ?? []) {
        if (a.quality_score == null) continue;
        const cur = acc.get(a.interview_id) ?? { sum: 0, n: 0 };
        cur.sum += Number(a.quality_score);
        cur.n += 1;
        acc.set(a.interview_id, cur);
      }
      qualityByInterview = new Map(
        Array.from(acc.entries()).map(([k, v]) => [k, { avg: v.sum / v.n, count: v.n }]),
      );
    }

    return {
      profile,
      tags: (tagsRes.data ?? []).map((t: any) => ({
        tag_value_id: t.tag_value_id,
        assigned_at: t.assigned_at,
        label: t.tag_values?.label ?? "—",
        dimension: t.tag_values?.tag_dimensions?.label ?? "",
      })),
      invitations: (invitesRes.data ?? []).map((i: any) => ({
        id: i.id,
        study_id: i.study_id,
        study_title: i.studies?.title ?? "—",
        channel: i.channel,
        status: i.status,
        sent_at: i.sent_at,
        created_at: i.created_at,
      })),
      interviews: (interviewsRes.data ?? []).map((i: any) => ({
        id: i.id,
        study_id: i.study_id,
        study_title: i.studies?.title ?? "—",
        status: i.status,
        source: i.source,
        started_at: i.started_at,
        finished_at: i.finished_at,
        quality: qualityByInterview.get(i.id) ?? null,
      })),
      compensation: (compRes.data ?? []).map((c: any) => ({
        id: c.id,
        amount: Number(c.amount),
        currency: c.currency,
        method: c.method,
        status: c.status,
        paid_at: c.paid_at,
        created_at: c.created_at,
        study_title: c.studies?.title ?? null,
      })),
    };
  });
