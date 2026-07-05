// Enrichment: derives quality/segments/tags/summary/tagline + per-answer summaries
// for an interview, saving to public.interview_insights.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatUrl } from "./ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRowStudyOwner } from "./authz";

const MODEL = "gemini-2.5-pro";

type EnrichmentResult = {
  quality: "excellent" | "good" | "average" | "low";
  segments: string[];
  tags: string[];
  bullet_summary: string[];
  tagline: string;
  answer_summaries: { question_id: string; summary: string }[];
};

// Passo interno de pipeline: roda também SEM usuário (webhook do Telegram,
// enrich-on-complete) e escreve interview_insights, cuja policy é só do dono
// do estudo — por isso opera inteiro em service-role (exceção do F-A4-B).
export async function enrichInterviewInternal(interview_id: string): Promise<void> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.warn("AI_API_KEY missing — skipping enrichment");
    return;
  }

  const { data: iv } = (await supabaseAdmin
    .from("interviews")
    .select(
      "id, study_id, external_respondent, respondent_id, studies:study_id(title, context, target_audience, business_goal)",
    )
    .eq("id", interview_id)
    .maybeSingle()) as {
    data: {
      id: string;
      study_id: string;
      external_respondent: Record<string, unknown> | null;
      respondent_id: string;
      studies: {
        title: string;
        context: string | null;
        target_audience: string | null;
        business_goal: string | null;
      } | null;
    } | null;
  };
  if (!iv) return;

  const { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, text, intent, position")
    .eq("study_id", iv.study_id)
    .order("position");

  const { data: answers } = await supabaseAdmin
    .from("answers")
    .select(
      "id, question_id, question_text, transcript, is_followup, status, parent_answer_id, created_at",
    )
    .eq("interview_id", interview_id)
    .order("created_at", { ascending: true });

  const readyAnswers = (answers ?? []).filter((a) => a.status === "ready" && a.transcript);
  if (readyAnswers.length === 0) return;

  // Respondent profile
  let profileBlock = "";
  if (iv.external_respondent) {
    profileBlock = `Perfil (upload externo): ${JSON.stringify(iv.external_respondent)}`;
  } else {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, city, state, age_range, occupation, industry, research_interests")
      .eq("id", iv.respondent_id)
      .maybeSingle();
    if (profile) profileBlock = `Perfil do respondente: ${JSON.stringify(profile)}`;
  }

  const qBlock = (questions ?? [])
    .map(
      (q, i) => `Q${i + 1} (id=${q.id}): ${q.text}${q.intent ? `\n  Intenção: ${q.intent}` : ""}`,
    )
    .join("\n");
  const aBlock = readyAnswers
    .map(
      (a) =>
        `[${a.is_followup ? "Follow-up" : "Pergunta"}] question_id=${a.question_id ?? "?"}\n  P: ${a.question_text}\n  R: ${a.transcript}`,
    )
    .join("\n\n");

  const system = `Você é um analista sênior de pesquisa qualitativa. Receberá perguntas, respostas transcritas e perfil do respondente. Gere insights estruturados em português do Brasil, concisos, baseados estritamente nos dados.`;

  const user = `Estudo: ${iv.studies?.title ?? ""}
Objetivo: ${iv.studies?.business_goal ?? "—"}
Contexto: ${iv.studies?.context ?? "—"}
Público-alvo: ${iv.studies?.target_audience ?? "—"}

${profileBlock}

Perguntas do estudo:
${qBlock}

Respostas transcritas:
${aBlock}

Use a ferramenta "save_insights" com:
- quality: avaliação geral da entrevista
- segments: 1 a 4 segmentos descritivos (ex: "Caçador de custo-benefício", "Young Adults (18-24)")
- tags: 2 a 8 tags curtas (cidade, perfil, comportamento-chave)
- bullet_summary: 3 a 5 bullets curtos com os pontos mais relevantes
- tagline: uma frase curta resumindo o respondente
- answer_summaries: para CADA pergunta do estudo, um resumo de 1 frase da resposta dada (use question_id; se respondente não respondeu, deixe summary vazio).`;

  const tools = [
    {
      type: "function",
      function: {
        name: "save_insights",
        description: "Salva os insights estruturados da entrevista.",
        parameters: {
          type: "object",
          properties: {
            quality: { type: "string", enum: ["excellent", "good", "average", "low"] },
            segments: { type: "array", items: { type: "string" }, maxItems: 4 },
            tags: { type: "array", items: { type: "string" }, maxItems: 8 },
            bullet_summary: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
            tagline: { type: "string" },
            answer_summaries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_id: { type: "string" },
                  summary: { type: "string" },
                },
                required: ["question_id", "summary"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "quality",
            "segments",
            "tags",
            "bullet_summary",
            "tagline",
            "answer_summaries",
          ],
          additionalProperties: false,
        },
      },
    },
  ];

  try {
    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "save_insights" } },
      }),
    });
    if (!res.ok) {
      console.error("enrichInterview AI error", res.status, await res.text());
      return;
    }
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      console.error("enrichInterview: no tool call");
      return;
    }
    const parsed = JSON.parse(call.function.arguments) as EnrichmentResult;

    await supabaseAdmin.from("interview_insights").upsert({
      interview_id,
      quality: parsed.quality,
      segments: parsed.segments ?? [],
      tags: parsed.tags ?? [],
      bullet_summary: parsed.bullet_summary ?? [],
      tagline: parsed.tagline ?? "",
      answer_summaries: parsed.answer_summaries ?? [],
      model: MODEL,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("enrichInterview failed", e);
  }
}

// Manual reprocess by the study owner
export const reprocessInterviewInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ interview_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: iv } = (await supabase
      .from("interviews")
      .select("id, studies:study_id(owner_id)")
      .eq("id", data.interview_id)
      .maybeSingle()) as { data: { id: string; studies: { owner_id: string } | null } | null };
    assertRowStudyOwner(iv, userId);
    await enrichInterviewInternal(data.interview_id);
    return { ok: true };
  });
