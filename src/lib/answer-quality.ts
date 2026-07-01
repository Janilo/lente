// AI quality scoring for a single answer — shared by the interview pipeline
// (interview.functions) and the researcher tooling (respondents.functions).
// Extracted from interview.functions.ts so the respondents slice no longer
// reaches into the interview slice for this helper (F-A1: cross-slice coupling).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatUrl } from "./ai.server";

export async function scoreAnswerInternal(answer_id: string, transcript?: string) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return;

  const { data: ans } = await supabaseAdmin
    .from("answers")
    .select("id, transcript, question_text, question_id")
    .eq("id", answer_id)
    .maybeSingle();
  if (!ans) return;
  const text = (transcript ?? ans.transcript ?? "").trim();
  if (!text) return;

  let intent = "";
  if (ans.question_id) {
    const { data: q } = await supabaseAdmin
      .from("questions")
      .select("intent")
      .eq("id", ans.question_id)
      .maybeSingle();
    intent = q?.intent ?? "";
  }

  const system = `Você avalia a qualidade de respostas de entrevistas qualitativas. Retorne SOMENTE JSON válido no formato: {"score": <inteiro 0-100>, "reasoning": "<frase curta em PT-BR>"}.
Critérios: relevância à pergunta (40%), profundidade/especificidade (30%), clareza (20%), aderência à intenção declarada (10%).`;
  const user = `Pergunta: ${ans.question_text}
${intent ? `Intenção da pergunta: ${intent}\n` : ""}Resposta transcrita: ${text}`;

  try {
    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return;
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const reasoning = String(parsed.reasoning ?? "").slice(0, 500);
    await supabaseAdmin
      .from("answers")
      .update({ quality_score: score, quality_reasoning: reasoning })
      .eq("id", answer_id);
  } catch (e) {
    console.error("scoreAnswerInternal", e);
  }
}
