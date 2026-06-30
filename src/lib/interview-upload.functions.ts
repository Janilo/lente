// Researcher-side upload of a full interview video.
// Flow:
//   1) createUploadedInterview → creates interview row + storage path
//   2) Client uploads file via supabase storage SDK
//   3) processUploadedInterview → STT + AI segmentation per question + enrichment

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatUrl } from "./ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrichInterviewInternal } from "./interview-enrichment.functions";

const BUCKET = "interview-videos";
const ALLOWED_EXT = new Set(["mp4", "webm", "mov", "m4v", "mkv"]);

const externalRespondentSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  age_range: z.string().trim().max(50).optional().default(""),
  occupation: z.string().trim().max(200).optional().default(""),
  industry: z.string().trim().max(200).optional().default(""),
});

export const createUploadedInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      study_id: z.string().uuid(),
      external_respondent: externalRespondentSchema,
      video_ext: z.string().min(1).max(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ext = data.video_ext.toLowerCase().replace(/^\./, "");
    if (!ALLOWED_EXT.has(ext)) throw new Error(`Formato não suportado: ${ext}`);

    const { data: study } = await supabaseAdmin
      .from("studies").select("id, owner_id").eq("id", data.study_id).maybeSingle();
    if (!study || study.owner_id !== userId) throw new Error("Acesso negado.");

    const { data: created, error } = await supabaseAdmin
      .from("interviews")
      .insert({
        study_id: data.study_id,
        respondent_id: userId, // placeholder — RLS / detail use study owner
        source: "upload",
        external_respondent: data.external_respondent,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const path = `${created.id}/full.${ext}`;
    return { interview_id: created.id, path };
  });

export const processUploadedInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      interview_id: z.string().uuid(),
      video_ext: z.string().min(1).max(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ext = data.video_ext.toLowerCase().replace(/^\./, "");

    const { data: iv } = await supabaseAdmin
      .from("interviews")
      .select("id, study_id, source, studies:study_id(owner_id)")
      .eq("id", data.interview_id)
      .maybeSingle() as { data: { id: string; study_id: string; source: string; studies: { owner_id: string } | null } | null };
    if (!iv || iv.studies?.owner_id !== userId) throw new Error("Acesso negado.");
    if (iv.source !== "upload") throw new Error("Esta entrevista não foi enviada por upload.");

    const path = `${iv.id}/full.${ext}`;

    // 1) Download
    const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (dlErr || !file) throw new Error(`Falha ao baixar vídeo: ${dlErr?.message ?? "arquivo não encontrado"}`);

    // 2) STT
    const { transcribeAudio } = await import("./stt.server");
    const stt = await transcribeAudio(file);
    const fullTranscript = (stt.transcript ?? "").trim();
    if (fullTranscript.length < 5) throw new Error("Nenhuma fala detectada no vídeo.");

    // 3) Load questions
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, text, intent, position")
      .eq("study_id", iv.study_id)
      .order("position");
    if (!questions || questions.length === 0) throw new Error("Estudo sem perguntas. Cadastre o roteiro antes de subir vídeos.");

    // 4) AI segmentation
    const segments = await segmentTranscriptByQuestion({
      transcript: fullTranscript,
      questions: questions.map((q) => ({ id: q.id, text: q.text, intent: q.intent ?? "" })),
    });

    // 5) Replace any prior answers for this interview, then insert one row per question
    await supabaseAdmin.from("answers").delete().eq("interview_id", iv.id);

    const rows = questions.map((q) => {
      const seg = segments.find((s) => s.question_id === q.id);
      const status: "ready" | "failed" = seg && seg.answer_transcript ? "ready" : "failed";
      return {
        interview_id: iv.id,
        question_id: q.id,
        question_text: q.text,
        is_followup: false,
        status,
        transcript: seg?.answer_transcript ?? null,
        start_seconds: seg?.start_seconds ?? null,
        end_seconds: seg?.end_seconds ?? null,
        video_path: path,
        error_message: seg?.answer_transcript ? null : "Trecho não identificado no vídeo.",
      };
    });

    const { error: insErr } = await supabaseAdmin.from("answers").insert(rows);
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("interviews").update({
      status: "completed",
      finished_at: new Date().toISOString(),
    }).eq("id", iv.id);

    // 6) Enrich asynchronously (await so the UI sees insights immediately)
    try { await enrichInterviewInternal(iv.id); } catch (e) { console.error("enrich error", e); }

    return { ok: true, interview_id: iv.id };
  });

type Segment = {
  question_id: string;
  answer_transcript: string;
  start_seconds: number | null;
  end_seconds: number | null;
};

async function segmentTranscriptByQuestion(args: {
  transcript: string;
  questions: { id: string; text: string; intent: string }[];
}): Promise<Segment[]> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY não configurada.");

  const qBlock = args.questions.map((q, i) => `Q${i + 1} (id=${q.id}): ${q.text}${q.intent ? `\n  Intenção: ${q.intent}` : ""}`).join("\n");

  const system = `Você organiza a transcrição de uma entrevista única em respostas por pergunta. Receberá a lista de perguntas do roteiro e a transcrição corrida. Para cada pergunta do roteiro, identifique o trecho da fala do respondente que corresponde à resposta, em português do Brasil.`;
  const user = `Perguntas do roteiro:
${qBlock}

Transcrição completa da entrevista:
"""${args.transcript}"""

Use a ferramenta "segment_answers" com um item por pergunta (use o question_id exato). Se uma pergunta não foi respondida, retorne answer_transcript vazio. Os campos de tempo (start_seconds/end_seconds) são opcionais — use null se não souber estimar.`;

  const tools = [{
    type: "function",
    function: {
      name: "segment_answers",
      description: "Devolve as respostas segmentadas por pergunta.",
      parameters: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_id: { type: "string" },
                answer_transcript: { type: "string" },
                start_seconds: { type: ["number", "null"] },
                end_seconds: { type: ["number", "null"] },
              },
              required: ["question_id", "answer_transcript"],
              additionalProperties: false,
            },
          },
        },
        required: ["segments"],
        additionalProperties: false,
      },
    },
  }];

  const res = await fetch(aiChatUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "segment_answers" } },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Segmentação por IA falhou: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("IA não retornou segmentação.");
  const parsed = JSON.parse(call.function.arguments) as { segments: Segment[] };
  return parsed.segments ?? [];
}
