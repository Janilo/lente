import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatUrl } from "./ai.server";

async function assertOwnership(supabase: any, userId: string, studyId: string) {
  const { data, error } = await supabase
    .from("studies")
    .select("id, title, business_goal, context, target_audience")
    .eq("id", studyId)
    .eq("owner_id", userId)
    .single();
  if (error || !data) throw new Error("Estudo não encontrado ou sem permissão");
  return data;
}

function splitLinesToQuestions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*(?:\d+[\.\)]|[-•*–])\s+/, "")
        .replace(/^\s*"|"\s*$/g, "")
        .trim(),
    )
    .filter((l) => l.length > 3 && l.length < 800)
    .filter((l) => !/^(perguntas?|roteiro|questionário)\s*:?$/i.test(l));
}

type ParsedBlock = {
  title: string;
  objective: string;
  questions: { text: string; intent: string }[];
};
type ParsedScript = { header: string; blocks: ParsedBlock[] };

async function structureWithAI(rawText: string): Promise<ParsedScript | null> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;

  const truncated = rawText.slice(0, 30000);

  const systemPrompt = `Você analisa roteiros de entrevista qualitativa em português do Brasil e extrai a estrutura.
Identifique:
- "header": título ou descrição geral do roteiro (vazio se não houver).
- "blocks": seções/blocos do roteiro. Cada bloco tem:
  - "title": nome do bloco (ex: "Aquecimento", "Jornada de compra"). Se o roteiro não tiver blocos explícitos, use um único bloco com title "Perguntas".
  - "objective": objetivo declarado do bloco (vazio se não houver).
  - "questions": lista de perguntas reais que devem ser feitas ao entrevistado.
    - "text": a pergunta exatamente como será feita.
    - "intent": o que essa pergunta busca revelar (vazio se não houver).
Regras:
- Ignore instruções para o entrevistador/moderador (ex: "anotar reação", "mostrar protótipo X"), notas de tempo, agradecimentos genéricos, cabeçalhos administrativos.
- Não invente perguntas. Use apenas o que está no texto.
- Preserve a ordem original.
- Se uma "pergunta" no texto for na verdade um objetivo ou instrução, coloque no campo correto, não em "questions".`;

  const tool = {
    type: "function",
    function: {
      name: "return_structure",
      description: "Devolve a estrutura do roteiro.",
      parameters: {
        type: "object",
        properties: {
          header: { type: "string" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                objective: { type: "string" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      intent: { type: "string" },
                    },
                    required: ["text", "intent"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "objective", "questions"],
              additionalProperties: false,
            },
          },
        },
        required: ["header", "blocks"],
        additionalProperties: false,
      },
    },
  } as const;

  try {
    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: truncated },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_structure" } },
      }),
    });
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos em Configurações > Workspace.");
    if (!res.ok) {
      console.error("AI structure error", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    const blocks: ParsedBlock[] = (parsed.blocks ?? [])
      .map((b: any) => ({
        title: (b.title ?? "").toString().trim() || "Perguntas",
        objective: (b.objective ?? "").toString().trim(),
        questions: (b.questions ?? [])
          .map((q: any) => ({
            text: (q.text ?? "").toString().trim(),
            intent: (q.intent ?? "").toString().trim(),
          }))
          .filter((q: any) => q.text),
      }))
      .filter((b: ParsedBlock) => b.questions.length > 0);
    if (blocks.length === 0) return null;
    return { header: (parsed.header ?? "").toString().trim(), blocks };
  } catch (e) {
    if (e instanceof Error && /Limite|Créditos/.test(e.message)) throw e;
    console.error("structureWithAI failed", e);
    return null;
  }
}

export const parseQuestionsFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        study_id: z.string().uuid(),
        file_name: z.string().min(1).max(300),
        mime_type: z.string().min(1).max(200),
        file_base64: z.string().min(1).max(8_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, userId, data.study_id);

    const buffer = Buffer.from(data.file_base64, "base64");
    const name = data.file_name.toLowerCase();
    let rawText = "";

    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (name.endsWith(".pdf")) {
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        rawText = Array.isArray(text) ? text.join("\n") : text;
      } catch (e) {
        throw new Error("Não consegui ler este PDF. Cole o texto em .txt ou tente um .docx.");
      }
    } else if (
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      data.mime_type.startsWith("text/")
    ) {
      rawText = buffer.toString("utf-8");
    } else {
      throw new Error("Formato não suportado. Use .txt, .md, .csv, .docx ou .pdf.");
    }

    if (!rawText.trim()) {
      throw new Error("Arquivo vazio ou sem texto legível.");
    }

    const structured = await structureWithAI(rawText);
    if (structured) return { script: structured };

    // Fallback: linha-a-linha
    const lines = splitLinesToQuestions(rawText).slice(0, 100);
    if (lines.length === 0) {
      throw new Error("Não encontrei perguntas no arquivo.");
    }
    return {
      script: {
        header: "",
        blocks: [
          {
            title: "Perguntas",
            objective: "",
            questions: lines.map((t) => ({ text: t, intent: "" })),
          },
        ],
      } as ParsedScript,
    };
  });

type GenSchema = {
  clarifications?: string[];
  questions?: { text: string; intent?: string }[];
};

export const generateQuestionScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        study_id: z.string().uuid(),
        extra_instructions: z.string().trim().max(2000).optional().default(""),
        target_count: z.number().int().min(3).max(20).optional().default(8),
        clarification_answers: z
          .array(z.object({ question: z.string(), answer: z.string() }))
          .max(10)
          .optional()
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const study = await assertOwnership(supabase, userId, data.study_id);

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) throw new Error("AI_API_KEY ausente");

    const contextBlock = [
      `Título do estudo: ${study.title ?? "—"}`,
      `Objetivo de negócio: ${study.business_goal ?? "—"}`,
      `Contexto: ${study.context ?? "—"}`,
      `Público-alvo: ${study.target_audience ?? "—"}`,
      data.extra_instructions ? `Instruções extras: ${data.extra_instructions}` : "",
      data.clarification_answers.length
        ? "Esclarecimentos do pesquisador:\n" +
          data.clarification_answers.map((c) => `- ${c.question}\n  R: ${c.answer}`).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const systemPrompt = `Você é um pesquisador qualitativo sênior. Seu trabalho é montar roteiros de entrevistas em profundidade em português do Brasil.
Princípios:
- Perguntas abertas, neutras, sem indução.
- Comece amplo (jornada, contexto) e afunile para específico (motivações, dores, alternativas, decisão).
- Evite perguntas de "sim/não" e jargões.
- Cada pergunta tem uma "intent" curta explicando o que ela deve revelar.
Se o contexto do estudo for insuficiente para gerar um roteiro útil, devolva apenas "clarifications" (até 3 perguntas curtas para o pesquisador). Caso contrário, devolva "questions" com ${data.target_count} itens.`;

    const tool = {
      type: "function",
      function: {
        name: "return_script",
        description: "Devolve o roteiro proposto ou perguntas de esclarecimento.",
        parameters: {
          type: "object",
          properties: {
            clarifications: {
              type: "array",
              items: { type: "string" },
              description: "Até 3 perguntas curtas para o pesquisador. Vazio se desnecessário.",
            },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  intent: { type: "string" },
                },
                required: ["text", "intent"],
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    } as const;

    const res = await fetch(aiChatUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextBlock },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_script" } },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos em Configurações > Workspace.");
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      throw new Error("Falha ao gerar o roteiro.");
    }
    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("Resposta da IA inválida.");
    let parsed: GenSchema;
    try {
      parsed = typeof call === "string" ? JSON.parse(call) : call;
    } catch {
      throw new Error("Não consegui interpretar a resposta da IA.");
    }

    const clarifications = (parsed.clarifications ?? []).filter((s) => s && s.trim()).slice(0, 3);
    const questions = (parsed.questions ?? [])
      .filter((q) => q?.text?.trim())
      .map((q) => ({ text: q.text.trim(), intent: (q.intent ?? "").trim() }))
      .slice(0, data.target_count);

    if (clarifications.length > 0 && questions.length === 0) {
      return { mode: "clarifications" as const, clarifications };
    }
    if (questions.length === 0) {
      throw new Error("A IA não retornou perguntas. Tente refinar o contexto.");
    }
    return { mode: "questions" as const, questions };
  });

export const bulkAddQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        study_id: z.string().uuid(),
        questions: z
          .array(
            z.object({
              text: z.string().trim().min(1).max(1000),
              intent: z.string().trim().max(1000).optional().default(""),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, userId, data.study_id);

    const { data: existing } = await supabase
      .from("questions")
      .select("position")
      .eq("study_id", data.study_id)
      .order("position", { ascending: false })
      .limit(1);
    const startPos = (existing?.[0]?.position ?? -1) + 1;

    const rows = data.questions.map((q, i) => ({
      study_id: data.study_id,
      position: startPos + i,
      text: q.text,
      intent: q.intent || null,
    }));
    const { error } = await supabase.from("questions").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
