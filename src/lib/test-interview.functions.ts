import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SeedQ = { text: string; intent: string; transcript: string; duration: number; score: number; reasoning: string };

const SEED_QUESTIONS: SeedQ[] = [
  {
    text: "Conte como foi sua última compra pelo aplicativo, do início ao fim.",
    intent: "Mapear o fluxo geral e identificar momentos críticos.",
    transcript:
      "Abri o app procurando um tênis de corrida. A busca encontrou rápido, mas tive que aplicar vários filtros porque apareceram modelos fora da minha numeração. Coloquei no carrinho e fui para o checkout. O cálculo de frete demorou e me deixou ansioso achando que tinha travado.",
    duration: 178,
    score: 87,
    reasoning: "Resposta detalhada cobrindo busca, filtro, carrinho e checkout com exemplos concretos.",
  },
  {
    text: "O que mais te incomodou ou gerou dúvida durante o processo?",
    intent: "Mapear atritos e pontos de fricção.",
    transcript:
      "O cálculo de frete demorou uns oito segundos sem nenhum feedback visual. Também não ficou claro se o cupom que eu tinha colocado tinha sido aplicado antes de finalizar a compra.",
    duration: 92,
    score: 81,
    reasoning: "Citou dois pontos específicos de fricção com contexto temporal.",
  },
  {
    text: "Se você pudesse mudar uma coisa no checkout, o que seria?",
    intent: "Coletar oportunidades de melhoria priorizadas pelo usuário.",
    transcript:
      "Colocaria um resumo bem claro no topo mostrando subtotal, frete, cupom aplicado e total final em destaque, logo acima do botão de pagar.",
    duration: 61,
    score: 78,
    reasoning: "Sugestão concreta e acionável.",
  },
  {
    text: "O que te faria recomendar o app para um amigo?",
    intent: "Identificar fatores de promoção e valor percebido.",
    transcript:
      "A variedade de produtos é boa e a entrega cumpre o prazo. Se resolverem essa parte do checkout, eu recomendaria de olhos fechados.",
    duration: 55,
    score: 74,
    reasoning: "Resposta clara identificando o que falta para promoção total.",
  },
];

export const createTestInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stamp = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    // 1. Study
    const { data: study, error: sErr } = await supabaseAdmin
      .from("studies")
      .insert({
        owner_id: userId,
        title: `Teste · Experiência de checkout (${stamp})`,
        status: "published",
        business_goal: "Validar o fluxo completo de pesquisa: roteiro → entrevista simulada → transcrição → síntese.",
        target_audience: "Consumidores que compraram pelo app nos últimos 30 dias.",
        context: "Estudo de teste criado automaticamente. Dados simulados para validar o pipeline ponta a ponta.",
        max_followups: 2,
      })
      .select("id, public_slug")
      .single();
    if (sErr || !study) throw new Error(sErr?.message ?? "Falha ao criar estudo.");

    // 2. Questions
    const { data: insertedQs, error: qErr } = await supabaseAdmin
      .from("questions")
      .insert(
        SEED_QUESTIONS.map((q, i) => ({
          study_id: study.id,
          position: i + 1,
          text: q.text,
          intent: q.intent,
        })),
      )
      .select("id, position");
    if (qErr || !insertedQs) throw new Error(qErr?.message ?? "Falha ao criar perguntas.");
    const qByPos = new Map(insertedQs.map((q) => [q.position, q.id]));

    // 3. Interview (the researcher acts as respondent in the test)
    const startedAt = new Date(Date.now() - 12 * 60 * 1000).toISOString();
    const finishedAt = new Date().toISOString();
    const { data: interview, error: iErr } = await supabaseAdmin
      .from("interviews")
      .insert({
        study_id: study.id,
        respondent_id: userId,
        status: "completed",
        started_at: startedAt,
        finished_at: finishedAt,
      })
      .select("id")
      .single();
    if (iErr || !interview) throw new Error(iErr?.message ?? "Falha ao criar entrevista.");

    // 4. Consent
    await supabaseAdmin.from("consents").insert({
      interview_id: interview.id,
      study_id: study.id,
      user_id: userId,
      consent_version: "v1.0",
      user_agent: "test-interview-mode",
    });

    // 5. Answers with simulated transcripts
    const answersToInsert = SEED_QUESTIONS.map((q, i) => ({
      interview_id: interview.id,
      question_id: qByPos.get(i + 1) ?? null,
      question_text: q.text,
      is_followup: false,
      status: "ready" as const,
      transcript: q.transcript,
      duration_seconds: q.duration,
      quality_score: q.score,
      quality_reasoning: q.reasoning,
    }));
    const { error: aErr } = await supabaseAdmin.from("answers").insert(answersToInsert);
    if (aErr) throw new Error(aErr.message);

    return { study_id: study.id, interview_id: interview.id };
  });
