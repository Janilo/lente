import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "janilo@pereirasaraiva.com";

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

export const adminListCompensation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });

    const { data: entries, error } = await supabaseAdmin
      .from("compensation_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const respondentIds = Array.from(
      new Set((entries ?? []).map((e) => e.respondent_id).filter(Boolean)),
    );
    const studyIds = Array.from(
      new Set((entries ?? []).map((e) => e.study_id).filter(Boolean) as string[]),
    );

    const [respondentsRes, studiesRes] = await Promise.all([
      respondentIds.length
        ? supabaseAdmin
            .from("respondent_profile")
            .select("id, full_name, email")
            .in("id", respondentIds)
        : Promise.resolve({ data: [], error: null }),
      studyIds.length
        ? supabaseAdmin
            .from("studies")
            .select("id, title")
            .in("id", studyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (respondentsRes.error) throw new Error(respondentsRes.error.message);
    if (studiesRes.error) throw new Error(studiesRes.error.message);

    const respondents = new Map((respondentsRes.data ?? []).map((r: any) => [r.id, r]));
    const studies = new Map((studiesRes.data ?? []).map((s: any) => [s.id, s]));

    const totals = {
      pending: 0,
      paid: 0,
      cancelled: 0,
      total_paid_brl: 0,
    };
    for (const e of entries ?? []) {
      if (e.status === "pending") totals.pending += 1;
      else if (e.status === "paid") {
        totals.paid += 1;
        if (e.currency === "BRL") totals.total_paid_brl += Number(e.amount ?? 0);
      } else if (e.status === "cancelled") totals.cancelled += 1;
    }

    return {
      entries: (entries ?? []).map((e) => ({
        ...e,
        respondent: respondents.get(e.respondent_id) ?? null,
        study: e.study_id ? studies.get(e.study_id) ?? null : null,
      })),
      totals,
    };
  });

export const adminListRespondentsForCompensation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data, error } = await supabaseAdmin
      .from("respondent_profile")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return { respondents: data ?? [] };
  });

export const adminListStudiesForCompensation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const { data, error } = await supabaseAdmin
      .from("studies")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { studies: data ?? [] };
  });

const createSchema = z.object({
  respondent_id: z.string().uuid(),
  study_id: z.string().uuid().optional().nullable(),
  amount: z.number().min(0).max(1_000_000),
  currency: z.string().min(3).max(3).default("BRL"),
  method: z.enum(["pix", "transfer", "voucher", "gift", "other"]),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
  reference: z.string().max(200).optional().nullable(),
  receipt_url: z.string().url().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  paid_at: z.string().optional().nullable(),
});

export const adminCreateCompensation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const userId = (context as { userId?: string }).userId;
    if (!userId) throw new Error("Sessão inválida.");

    const payload: Record<string, unknown> = {
      respondent_id: data.respondent_id,
      study_id: data.study_id ?? null,
      amount: data.amount,
      currency: data.currency,
      method: data.method,
      status: data.status,
      reference: data.reference ?? null,
      receipt_url: data.receipt_url ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    };
    if (data.status === "paid") {
      payload.paid_at = data.paid_at ?? new Date().toISOString();
    } else if (data.paid_at) {
      payload.paid_at = data.paid_at;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("compensation_log")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: inserted };
  });

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "paid", "cancelled"]),
});

export const adminUpdateCompensationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status === "pending") patch.paid_at = null;

    const { error } = await supabaseAdmin
      .from("compensation_log")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCompensation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const { error } = await supabaseAdmin
      .from("compensation_log")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
