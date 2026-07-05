import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FIX, USERS, anonClient, localStack, serviceClient, signIn } from "./stack";

// RLS do material de entrevista: interviews, answers, consents, vídeos no
// storage e a RPC delete_respondent_data (direito de apagar os próprios dados).

const env = localStack();
const d = describe.skipIf(!env);

d("entrevistas, respostas e vídeos", () => {
  let anon: SupabaseClient;
  let ana: SupabaseClient;
  let bruno: SupabaseClient;
  let rita: SupabaseClient;
  let rafael: SupabaseClient;
  let service: SupabaseClient;

  beforeAll(async () => {
    if (!env) return;
    anon = anonClient(env);
    service = serviceClient(env);
    [ana, bruno, rita, rafael] = await Promise.all([
      signIn(env, USERS.ana.email),
      signIn(env, USERS.bruno.email),
      signIn(env, USERS.rita.email),
      signIn(env, USERS.rafael.email),
    ]);
  });

  it("matriz de visibilidade das entrevistas: respondente e dono do estudo, mais ninguém", async () => {
    const ids = async (c: SupabaseClient) =>
      (await c.from("interviews").select("id")).data?.map((r) => r.id);
    expect(await ids(rita)).toEqual([FIX.interviewA1]);
    expect(await ids(rafael)).toEqual([FIX.interviewB1]);
    expect(await ids(ana)).toEqual([FIX.interviewA1]);
    expect(await ids(bruno)).toEqual([FIX.interviewB1]);
    expect(await ids(anon)).toEqual([]);
  });

  it("answers seguem a entrevista: respondente vê as suas, dono vê as do estudo", async () => {
    expect((await rita.from("answers").select("id")).data).toHaveLength(2);
    expect((await ana.from("answers").select("id")).data).toHaveLength(2);
    expect((await rafael.from("answers").select("id")).data).toHaveLength(1);
    expect((await bruno.from("answers").select("id")).data).toHaveLength(1);
    const cruzada = await rita.from("answers").select("id").eq("id", FIX.answerB1);
    expect(cruzada.data).toEqual([]);
  });

  it("respondente escreve resposta na própria entrevista; na alheia é barrado", async () => {
    const propria = {
      id: "33333333-0000-4000-8000-000000000091",
      interview_id: FIX.interviewA1,
      question_text: "Resposta temporária do teste",
    };
    const insert = await rita.from("answers").insert(propria);
    expect(insert.error).toBeNull();
    const del = await rita.from("answers").delete().eq("id", propria.id);
    expect(del.error).toBeNull();

    const alheia = await rafael
      .from("answers")
      .insert({ ...propria, id: "33333333-0000-4000-8000-000000000092" });
    expect(alheia.error?.code).toBe("42501");
  });

  it("F-RLS-2 resolvido: respondente cria entrevista em estudo publicado; rascunho e personificação, não", async () => {
    // A policy fazia EXISTS direto em studies e era letra morta (subquery de
    // policy respeita a RLS de studies de quem consulta) — o startInterview do
    // runner, que insere com o client do usuário, ficava quebrado para
    // respondente real. Desde a migration 20260705142000 o "publicado" vem de
    // study_is_published() (SECURITY DEFINER) e funciona como desenhado.
    const id = "22222222-0000-4000-8000-000000000098";
    const publicado = await rafael.from("interviews").insert({
      id,
      study_id: FIX.studyB2,
      respondent_id: USERS.rafael.id,
    });
    expect(publicado.error).toBeNull();

    const rascunho = await rafael.from("interviews").insert({
      id: "22222222-0000-4000-8000-000000000097",
      study_id: FIX.studyB1,
      respondent_id: USERS.rafael.id,
    });
    expect(rascunho.error?.code).toBe("42501");

    const personificacao = await rafael.from("interviews").insert({
      id: "22222222-0000-4000-8000-000000000096",
      study_id: FIX.studyB2,
      respondent_id: USERS.rita.id,
    });
    expect(personificacao.error?.code).toBe("42501");

    await service.from("interviews").delete().eq("id", id);
  });

  it("consents: respondente vê os próprios, dono do estudo vê os do estudo, e ninguém assina pelo outro", async () => {
    expect((await rita.from("consents").select("id")).data).toHaveLength(1);
    expect((await ana.from("consents").select("id")).data).toHaveLength(1);
    expect((await bruno.from("consents").select("id")).data).toEqual([]);
    expect((await rafael.from("consents").select("id")).data).toEqual([]);

    const porOutro = await rafael.from("consents").insert({
      interview_id: FIX.interviewB1,
      user_id: USERS.rita.id,
      study_id: FIX.studyB2,
      consent_version: "v1",
    });
    expect(porOutro.error?.code).toBe("42501");
  });

  it("storage: vídeo da entrevista sobe/desce só para respondente e dono do estudo", async () => {
    const path = `${FIX.interviewA1}/rls-check.webm`;
    const blob = new Blob(["conteudo-de-teste"], { type: "video/webm" });

    const upload = await rita.storage.from("interview-videos").upload(path, blob, { upsert: true });
    expect(upload.error).toBeNull();

    const invasor = await rafael.storage
      .from("interview-videos")
      .upload(`${FIX.interviewA1}/invasao.webm`, blob, { upsert: true });
    expect(invasor.error).toBeTruthy();

    const dono = await ana.storage.from("interview-videos").download(path);
    expect(dono.error).toBeNull();

    const cruzado = await rafael.storage.from("interview-videos").download(path);
    expect(cruzado.error).toBeTruthy();

    const semLogin = await anon.storage.from("interview-videos").download(path);
    expect(semLogin.error).toBeTruthy();

    const remove = await rita.storage.from("interview-videos").remove([path]);
    expect(remove.error).toBeNull();
  });

  it("delete_respondent_data: só o respondente ou o dono; apaga answers+consents+interview", async () => {
    // Quem não é parte da entrevista é barrado (e nada é apagado).
    const negado = await bruno.rpc("delete_respondent_data", { p_interview_id: FIX.interviewA1 });
    expect(negado.error?.message).toContain("Acesso negado");
    expect((await ana.from("interviews").select("id").eq("id", FIX.interviewA1)).data).toHaveLength(
      1,
    );

    // Entrevista descartável para o caminho feliz (montada via service-role).
    const descartavel = "22222222-0000-4000-8000-000000000099";
    await service.from("interviews").insert({
      id: descartavel,
      study_id: FIX.studyA,
      respondent_id: USERS.rita.id,
      status: "completed",
    });
    await service.from("answers").insert({
      interview_id: descartavel,
      question_text: "Descartável",
    });

    const ok = await rita.rpc("delete_respondent_data", { p_interview_id: descartavel });
    expect(ok.error).toBeNull();
    expect((await service.from("interviews").select("id").eq("id", descartavel)).data).toEqual([]);
    expect(
      (await service.from("answers").select("id").eq("interview_id", descartavel)).data,
    ).toEqual([]);
  });
});
