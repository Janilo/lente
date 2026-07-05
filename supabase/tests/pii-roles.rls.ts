import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FIX, USERS, anonClient, localStack, signIn } from "./stack";

// RLS de PII e papéis: respondent_profile, respondent_tags, user_roles,
// profiles, compensation_log, telegram_sessions, app_settings,
// cta_click_events e a view respondent_stats (security_invoker).
//
// ─── ACHADO F-SEC-1 (comportamento REAL da produção, provado aqui) ─────────
// O trigger handle_new_user dá role 'researcher' a TODO usuário novo — também
// a quem se cadastra como respondente — e nada a remove. Combinado com a
// policy "Researcher can view all respondent profiles", qualquer conta
// recém-criada lê a tabela inteira de PII de respondentes (nome, e-mail,
// telefone, faixa de renda). As personas do seed modelam os dois estados:
//   rita   = como o cadastro deixa hoje (researcher automática) → prova o vazamento
//   rafael = estado pretendido (só 'respondent') → prova que as policies,
//            com a role certa, isolam corretamente
// A correção (migration futura, fora deste PR): handle_new_user parar de
// atribuir 'researcher' por padrão, atribuindo-a só no fluxo de pesquisador.
// Quando isso acontecer, o teste "F-SEC-1" abaixo deve passar a falhar — é
// deliberado: inverta o assert junto com a correção.
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

  it("F-SEC-1: conta recém-cadastrada (rita) lê a PII de TODOS os respondentes", async () => {
    const { data, error } = await rita
      .from("respondent_profile")
      .select("user_id, email, phone, income_range");
    expect(error).toBeNull();
    // Rita deveria ver só o próprio perfil; vê os dois — inclusive telefone e
    // renda do Rafael. Este assert documenta o estado atual da produção.
    expect(data).toHaveLength(2);
    const doRafael = data?.find((r) => r.user_id === USERS.rafael.id);
    expect(doRafael?.phone).toBe("+55 21 91234-0002");
    expect(doRafael?.income_range).toBe("10k-20k");
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

  it("user_roles: cada um vê só as próprias — e a da rita é 'researcher' (raiz do F-SEC-1)", async () => {
    const daRita = await rita.from("user_roles").select("role");
    expect(daRita.data?.map((r) => r.role)).toEqual(["researcher"]);
    const doRafael = await rafael.from("user_roles").select("role");
    expect(doRafael.data?.map((r) => r.role)).toEqual(["respondent"]);
    const daAna = await ana.from("user_roles").select("user_id");
    expect(daAna.data?.map((r) => r.user_id)).toEqual([USERS.ana.id]);
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
  });

  it("respondent_stats (security_invoker) não vaza métricas: cada um computa só o que pode ver", async () => {
    // Rafael (só respondent): uma linha — a própria — com a própria entrevista.
    const doRafael = await rafael.from("respondent_stats").select("*");
    expect(doRafael.data).toHaveLength(1);
    expect(doRafael.data?.[0].user_id).toBe(USERS.rafael.id);
    expect(doRafael.data?.[0].interviews_count).toBe(1);

    // Rita (researcher automática) vê os DOIS perfis (F-SEC-1), mas as
    // entrevistas do Rafael continuam invisíveis: a linha dele zera.
    const daRita = await rita.from("respondent_stats").select("*");
    expect(daRita.data).toHaveLength(2);
    const rafaelViaRita = daRita.data?.find((r) => r.user_id === USERS.rafael.id);
    expect(rafaelViaRita?.interviews_count).toBe(0);

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
