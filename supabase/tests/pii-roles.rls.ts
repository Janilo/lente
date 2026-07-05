import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FIX, USERS, anonClient, localStack, signIn } from "./stack";

// RLS de PII e papéis: respondent_profile, respondent_tags, user_roles,
// profiles, compensation_log, telegram_sessions, app_settings,
// cta_click_events e a view respondent_stats (security_invoker).
//
// ─── F-SEC-1 (CORRIGIDO pela migration 20260705090500) ─────────────────────
// O trigger handle_new_user dava role 'researcher' a TODO usuário novo; com a
// policy "Researcher can view all respondent profiles", qualquer conta
// recém-criada lia a PII inteira de respondentes. Desde a correção, o cadastro
// não concede role nenhuma — 'researcher' é privilégio dado pelo admin. As
// personas do seed modelam isso:
//   rita   = cadastro cru (nenhuma role) → o teste F-SEC-1 prova que ela NÃO
//            lê PII alheia
//   rafael = respondente com role 'respondent' concedida → prova que essa
//            role não abre nada indevido
//   ana    = pesquisadora com 'researcher' concedida → o acesso amplo é dela,
//            por concessão, não do cadastro
// ────────────────────────────────────────────────────────────────────────────

const env = localStack();
const d = describe.skipIf(!env);

d("PII, papéis e áreas de admin", () => {
  let anon: SupabaseClient;
  let admin: SupabaseClient;
  let ana: SupabaseClient;
  let bruno: SupabaseClient;
  let rita: SupabaseClient;
  let rafael: SupabaseClient;

  beforeAll(async () => {
    if (!env) return;
    anon = anonClient(env);
    [admin, ana, bruno, rita, rafael] = await Promise.all([
      signIn(env, USERS.admin.email),
      signIn(env, USERS.ana.email),
      signIn(env, USERS.bruno.email),
      signIn(env, USERS.rita.email),
      signIn(env, USERS.rafael.email),
    ]);
  });

  it("F-SEC-1 corrigido: conta recém-cadastrada (rita) NÃO lê PII alheia — só o próprio perfil", async () => {
    const { data, error } = await rita
      .from("respondent_profile")
      .select("user_id, email, phone, income_range");
    expect(error).toBeNull();
    // Antes da migration 20260705090500 o cadastro dava 'researcher' e este
    // select devolvia TODOS os perfis (telefone e renda do rafael inclusos).
    expect(data).toHaveLength(1);
    expect(data?.[0].user_id).toBe(USERS.rita.id);
  });

  it("estado pretendido (rafael, só role respondent): lê apenas o próprio perfil", async () => {
    const { data } = await rafael.from("respondent_profile").select("user_id");
    expect(data?.map((r) => r.user_id)).toEqual([USERS.rafael.id]);
  });

  it("pesquisadora e admin veem todos os perfis (intencional); anon, nenhum", async () => {
    expect((await ana.from("respondent_profile").select("id")).data).toHaveLength(2);
    expect((await admin.from("respondent_profile").select("id")).data).toHaveLength(2);
    expect((await anon.from("respondent_profile").select("id")).data).toEqual([]);
  });

  it("respondente não edita perfil alheio (0 linhas afetadas), só o próprio", async () => {
    const alheio = await rafael
      .from("respondent_profile")
      .update({ notes: "invasão" })
      .eq("id", FIX.respondentRita)
      .select("id");
    expect(alheio.error).toBeNull();
    expect(alheio.data).toEqual([]);

    const proprio = await rafael
      .from("respondent_profile")
      .update({ notes: "atualizado pelo dono" })
      .eq("id", FIX.respondentRafael)
      .select("id");
    expect(proprio.data).toHaveLength(1);
    await rafael.from("respondent_profile").update({ notes: null }).eq("id", FIX.respondentRafael);
  });

  it("respondent_tags: dono da tag e researcher veem; outro respondente, não", async () => {
    expect((await rita.from("respondent_tags").select("tag_value_id")).data).toHaveLength(1);
    expect((await ana.from("respondent_tags").select("tag_value_id")).data).toHaveLength(1);
    expect((await rafael.from("respondent_tags").select("tag_value_id")).data).toEqual([]);
  });

  it("user_roles: cada um vê só as próprias — e cadastro cru (rita) não tem role nenhuma", async () => {
    const daRita = await rita.from("user_roles").select("role");
    expect(daRita.data).toEqual([]);
    const doRafael = await rafael.from("user_roles").select("role");
    expect(doRafael.data?.map((r) => r.role)).toEqual(["respondent"]);
    const daAna = await ana.from("user_roles").select("user_id, role");
    expect(daAna.data).toEqual([{ user_id: USERS.ana.id, role: "researcher" }]);
  });

  it("profiles: usuário vê o próprio; admin vê todos", async () => {
    expect((await ana.from("profiles").select("id")).data?.map((r) => r.id)).toEqual([
      USERS.ana.id,
    ]);
    expect((await admin.from("profiles").select("id")).data).toHaveLength(5);
  });

  it("can_publish é blindado: nem o próprio usuário se autopromove", async () => {
    const tentativa = await bruno
      .from("profiles")
      .update({ can_publish: true })
      .eq("id", USERS.bruno.id);
    expect(tentativa.error?.message).toContain("Apenas administradores");
  });

  it("compensation_log: admin tudo; respondente e dono do estudo, as suas; demais, nada", async () => {
    expect((await admin.from("compensation_log").select("id")).data).toHaveLength(1);
    expect((await rita.from("compensation_log").select("id")).data).toHaveLength(1);
    expect((await ana.from("compensation_log").select("id")).data).toHaveLength(1);
    expect((await bruno.from("compensation_log").select("id")).data).toEqual([]);
    expect((await rafael.from("compensation_log").select("id")).data).toEqual([]);

    const insercao = await rita.from("compensation_log").insert({
      respondent_id: FIX.respondentRita,
      amount: 999,
      created_by: USERS.rita.id,
    });
    expect(insercao.error?.code).toBe("42501");
  });

  it("telegram_sessions e app_settings são só do admin", async () => {
    expect((await admin.from("telegram_sessions").select("chat_id")).data).toHaveLength(1);
    expect((await ana.from("telegram_sessions").select("chat_id")).data).toEqual([]);
    expect((await rita.from("telegram_sessions").select("chat_id")).data).toEqual([]);

    expect((await admin.from("app_settings").select("stt_provider")).data).toHaveLength(1);
    expect((await ana.from("app_settings").select("stt_provider")).data).toEqual([]);
    const update = await ana
      .from("app_settings")
      .update({ stt_provider: "assemblyai" })
      .eq("id", true)
      .select("id");
    expect(update.data).toEqual([]);
  });

  it("cta_click_events: anon só insere o CTA conhecido; leitura é de researcher", async () => {
    const valido = await anon.from("cta_click_events").insert({
      cta_id: "footer_respondents_signup",
      href: "https://lente.app/respondentes",
    });
    expect(valido.error).toBeNull();

    const invalido = await anon.from("cta_click_events").insert({
      cta_id: "outro_cta",
      href: "https://lente.app/x",
    });
    expect(invalido.error?.code).toBe("42501");

    const daAna = await ana.from("cta_click_events").select("id");
    expect(daAna.data?.length).toBeGreaterThanOrEqual(1);
    expect((await rafael.from("cta_click_events").select("id")).data).toEqual([]);
    expect((await rita.from("cta_click_events").select("id")).data).toEqual([]);
  });

  it("respondent_stats (security_invoker) não vaza métricas: cada um computa só o que pode ver", async () => {
    // Rafael (só respondent): uma linha — a própria — com a própria entrevista.
    const doRafael = await rafael.from("respondent_stats").select("*");
    expect(doRafael.data).toHaveLength(1);
    expect(doRafael.data?.[0].user_id).toBe(USERS.rafael.id);
    expect(doRafael.data?.[0].interviews_count).toBe(1);

    // Rita (cadastro cru, sem role): só a própria linha, com a própria entrevista.
    const daRita = await rita.from("respondent_stats").select("*");
    expect(daRita.data).toHaveLength(1);
    expect(daRita.data?.[0].user_id).toBe(USERS.rita.id);
    expect(daRita.data?.[0].interviews_count).toBe(1);

    // Ana vê a linha da Rita computada com a entrevista do Estudo A.
    const daAna = await ana.from("respondent_stats").select("*");
    const ritaViaAna = daAna.data?.find((r) => r.user_id === USERS.rita.id);
    expect(ritaViaAna?.interviews_count).toBe(1);
    expect(ritaViaAna?.completed_count).toBe(1);
    expect(Number(ritaViaAna?.avg_quality_score)).toBe(80);
    const rafaelViaAna = daAna.data?.find((r) => r.user_id === USERS.rafael.id);
    expect(rafaelViaAna?.interviews_count).toBe(0);
  });
});
