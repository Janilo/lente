import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FIX, USERS, anonClient, localStack, serviceClient, signIn } from "./stack";

// RLS de estudos e do conteúdo do pesquisador (questions, screener, insights,
// recommendations, interview_insights) + triggers de publicação.

const env = localStack();
const d = describe.skipIf(!env);

d("studies e conteúdo do pesquisador", () => {
  let anon: SupabaseClient;
  let admin: SupabaseClient;
  let ana: SupabaseClient;
  let bruno: SupabaseClient;
  let rita: SupabaseClient;
  let service: SupabaseClient;

  beforeAll(async () => {
    if (!env) return;
    anon = anonClient(env);
    service = serviceClient(env);
    [admin, ana, bruno, rita] = await Promise.all([
      signIn(env, USERS.admin.email),
      signIn(env, USERS.ana.email),
      signIn(env, USERS.bruno.email),
      signIn(env, USERS.rita.email),
    ]);
  });

  it("anon não lê studies — nem os publicados (o slug público resolve via serverFn)", async () => {
    const { data, error } = await anon.from("studies").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon lê perguntas e screener de estudo publicado; de rascunho, nada", async () => {
    const published = await anon.from("questions").select("id").eq("study_id", FIX.studyA);
    expect(published.error).toBeNull();
    expect(published.data).toHaveLength(2);

    const draft = await anon.from("questions").select("id").eq("study_id", FIX.studyB1);
    expect(draft.error).toBeNull();
    expect(draft.data).toEqual([]);

    const screener = await anon.from("screener_questions").select("id").eq("study_id", FIX.studyA);
    expect(screener.error).toBeNull();
    expect(screener.data).toHaveLength(1);
  });

  it("cada dono vê só os próprios estudos", async () => {
    const deAna = await ana.from("studies").select("id");
    expect(deAna.data?.map((r) => r.id)).toEqual([FIX.studyA]);

    const deBruno = await bruno.from("studies").select("id");
    expect(deBruno.data?.map((r) => r.id).sort()).toEqual([FIX.studyB1, FIX.studyB2]);
  });

  it("não há leitura transversal de studies: nem admin, nem respondente participante", async () => {
    // Não existe policy de admin em studies — o admin (sem estudo próprio) vê zero.
    const doAdmin = await admin.from("studies").select("id");
    expect(doAdmin.data).toEqual([]);

    // Rita participou do Estudo A, mas estudo é do dono; ela também vê zero.
    const daRita = await rita.from("studies").select("id");
    expect(daRita.data).toEqual([]);
  });

  it("dono gerencia perguntas do próprio estudo; em estudo alheio é barrado", async () => {
    const nova = {
      id: "11111111-0000-4000-8000-000000000091",
      study_id: FIX.studyA,
      position: 3,
      text: "Pergunta temporária do teste",
    };
    const insert = await ana.from("questions").insert(nova);
    expect(insert.error).toBeNull();
    const del = await ana.from("questions").delete().eq("id", nova.id);
    expect(del.error).toBeNull();

    const alheio = await ana
      .from("questions")
      .insert({ ...nova, id: "11111111-0000-4000-8000-000000000092", study_id: FIX.studyB1 });
    expect(alheio.error?.code).toBe("42501");
  });

  it("insights e recommendations são do dono do estudo — role researcher não abre nada", async () => {
    expect((await ana.from("insights").select("id")).data).toHaveLength(1);
    expect((await bruno.from("insights").select("id")).data).toEqual([]);
    // Rita tem role researcher (dada pelo trigger de cadastro), e mesmo assim: zero.
    expect((await rita.from("insights").select("id")).data).toEqual([]);
    expect((await ana.from("recommendations").select("id")).data).toHaveLength(1);
    expect((await bruno.from("recommendations").select("id")).data).toEqual([]);
  });

  it("interview_insights é do dono do estudo — nem o respondente da entrevista lê a análise", async () => {
    const daAna = await ana.from("interview_insights").select("interview_id");
    expect(daAna.data?.map((r) => r.interview_id)).toEqual([FIX.interviewA1]);
    expect((await rita.from("interview_insights").select("interview_id")).data).toEqual([]);
    expect((await bruno.from("interview_insights").select("interview_id")).data).toEqual([]);
  });

  it("publicar exige can_publish: o trigger barra quem não tem", async () => {
    // Rita pode criar estudo próprio em rascunho…
    const rascunho = {
      id: "aaaaaaaa-0000-4000-8000-000000000091",
      owner_id: USERS.rita.id,
      title: "Estudo da Rita (teste)",
      public_slug: "estudo-rita-rls-teste",
    };
    const insert = await rita.from("studies").insert(rascunho);
    expect(insert.error).toBeNull();

    // …mas publicar sem can_publish explode no trigger.
    const publica = await rita
      .from("studies")
      .update({ status: "published" })
      .eq("id", rascunho.id);
    expect(publica.error?.message).toContain("Publicação não liberada");

    // Bruno (can_publish=false) tentando publicar o próprio rascunho: idem.
    const brunoPublica = await bruno
      .from("studies")
      .update({ status: "published" })
      .eq("id", FIX.studyB1);
    expect(brunoPublica.error?.message).toContain("Publicação não liberada");

    // Ana (can_publish=true) publica direto no insert.
    const deAna = {
      id: "aaaaaaaa-0000-4000-8000-000000000092",
      owner_id: USERS.ana.id,
      title: "Estudo publicado pela Ana (teste)",
      status: "published",
      public_slug: "estudo-ana-rls-teste",
    };
    const anaInsert = await ana.from("studies").insert(deAna);
    expect(anaInsert.error).toBeNull();

    await service.from("studies").delete().in("id", [rascunho.id, deAna.id]);
  });
});
