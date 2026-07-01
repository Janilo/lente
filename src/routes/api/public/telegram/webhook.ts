import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deriveTelegramWebhookSecret, safeEqualString, sendMessage, sendChatAction, downloadTelegramFile } from "@/lib/telegram.server";
import { computeNextStep } from "@/lib/interview.functions";
import { scoreAnswerInternal } from "@/lib/answer-quality";
import { transcribeAudio } from "@/lib/stt.server";

const BUCKET = "interview-videos";

type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number };
type TgVoice = { file_id: string; duration?: number };
type TgVideo = { file_id: string; duration?: number };
type TgMessage = {
 message_id: number;
 from?: TgUser;
 chat: TgChat;
 text?: string;
 voice?: TgVoice;
 audio?: TgVoice;
 video?: TgVideo;
 video_note?: TgVideo;
};

async function getSession(chat_id: number) {
 const { data } = await supabaseAdmin.from("telegram_sessions").select("*").eq("chat_id", chat_id).maybeSingle();
 return data;
}

async function upsertSession(chat_id: number, patch: Record<string, unknown>) {
 await supabaseAdmin.from("telegram_sessions").upsert({ chat_id, ...patch }, { onConflict: "chat_id"});
}

function welcomeText(studyTitle: string, questionCount: number) {
 return `<b>Bem-vindo(a) à pesquisa: ${escapeHtml(studyTitle)}</b>\n\nSerão cerca de <b>${questionCount}</b> perguntas. Você pode responder por <b>texto</b>, <b>áudio</b> ou <b>vídeo</b> — fique à vontade.\n\nA IA pode fazer perguntas de aprofundamento para entender melhor sua resposta.\n\n<b>Termo LGPD:</b> ao continuar, você concorda que suas respostas (e transcrições) serão usadas para fins de pesquisa pelo organizador do estudo, com possibilidade de exclusão a qualquer momento.\n\nResponda <b>SIM</b> para começar, ou /cancelar para sair.`;
}

function escapeHtml(s: string) {
 return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]!));
}

async function startInterviewForChat(chat_id: number, slug: string, from?: TgUser) {
 const { data: study } = await supabaseAdmin
 .from("studies")
 .select("id, title, status")
 .eq("public_slug", slug)
 .maybeSingle();
 if (!study || study.status !== "published") {
 await sendMessage(chat_id, "Este estudo não está disponível ou não foi publicado.");
 return;
 }
 const { count } = await supabaseAdmin
 .from("questions").select("id", { count: "exact", head: true }).eq("study_id", study.id);

 await upsertSession(chat_id, {
 study_id: study.id,
 interview_id: null,
 state: "awaiting_consent",
 awaiting_consent: true,
 pending_question_id: null,
 pending_is_followup: false,
 pending_parent_answer_id: null,
 pending_question_text: null,
 telegram_first_name: from?.first_name ?? null,
 telegram_username: from?.username ?? null,
 });

 await sendMessage(chat_id, welcomeText(study.title, count ?? 0));
}

async function createInterviewAndStart(chat_id: number, session: any) {
 const { data: created, error } = await supabaseAdmin
 .from("interviews")
 .insert({
 study_id: session.study_id,
 respondent_id: null,
 source: "telegram",
 external_respondent: {
 telegram_chat_id: chat_id,
 telegram_username: session.telegram_username,
 telegram_first_name: session.telegram_first_name,
 },
 })
 .select("id")
 .single();
 if (error || !created) {
 await sendMessage(chat_id, "Não consegui iniciar sua entrevista. Tente novamente em alguns minutos.");
 return;
 }
 await upsertSession(chat_id, {
 interview_id: created.id,
 awaiting_consent: false,
 state: "interviewing",
 });
 await advance(chat_id, created.id);
}

async function advance(chat_id: number, interview_id: string) {
 // Reload session study_id
 const next = await computeNextStep(interview_id);
 if (next.type === "done") {
 await supabaseAdmin.from("interviews").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", interview_id);
 await upsertSession(chat_id, { state: "done", pending_question_id: null, pending_question_text: null });
 await sendMessage(chat_id, "✅ <b>Entrevista concluída!</b> Muito obrigado pela sua participação.");
 try {
 const { enrichInterviewInternal } = await import("@/lib/interview-enrichment.functions");
 await enrichInterviewInternal(interview_id);
 } catch (e) { console.error("enrich failed", e); }
 return;
 }
 if (next.type === "processing") {
 await sendMessage(chat_id, "⏳ Ainda estou processando sua última resposta. Aguarde só um instante…");
 return;
 }
 // question or followup
 const n = next as { type: "question"| "followup"; question_id: string; text: string; parent_answer_id?: string | null; position?: number };
 await upsertSession(chat_id, {
 pending_question_id: n.question_id,
 pending_is_followup: n.type === "followup",
 pending_parent_answer_id: n.type === "followup"? (n.parent_answer_id ?? null) : null,
 pending_question_text: n.text,
 state: "awaiting_answer",
 });
 const prefix = n.type === "followup"? "↪️ <i>Aprofundamento:</i>\n\n": `<b>Pergunta ${n.position ?? ""}:</b>\n\n`;
 await sendMessage(chat_id, `${prefix}${escapeHtml(n.text)}\n\n<i>Responda por texto, áudio ou vídeo.</i>`);
}

async function recordAnswer(chat_id: number, session: any, opts: { transcript?: string; mediaBlob?: Blob; duration?: number }) {
 const interview_id = session.interview_id as string;
 const question_id = session.pending_question_id as string;
 const is_followup = !!session.pending_is_followup;
 const question_text = session.pending_question_text as string;
 const parent_answer_id = (session.pending_parent_answer_id as string | null) ?? null;

 const { data: ans, error } = await supabaseAdmin.from("answers").insert({
 interview_id,
 question_id,
 question_text,
 is_followup,
 parent_answer_id,
 status: opts.mediaBlob ? "transcribing": "ready",
 transcript: opts.transcript ?? null,
 duration_seconds: opts.duration ?? null,
 }).select("id").single();
 if (error || !ans) {
 await sendMessage(chat_id, "Não consegui registrar sua resposta. Pode tentar novamente?");
 return;
 }

 // If media, upload + transcribe
 if (opts.mediaBlob) {
 try {
 const path = `${interview_id}/${ans.id}.webm`;
 const buf = await opts.mediaBlob.arrayBuffer();
 await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: "audio/ogg", upsert: true });
 await supabaseAdmin.from("answers").update({ video_path: path }).eq("id", ans.id);
 const { transcript } = await transcribeAudio(opts.mediaBlob);
 const cleaned = (transcript ?? "").trim();
 if (cleaned.length < 2) {
 await supabaseAdmin.from("answers").update({ status: "failed", error_message: "Nenhuma fala detectada."}).eq("id", ans.id);
 await sendMessage(chat_id, "Não consegui entender o áudio 😕. Pode responder novamente (texto ou áudio mais claro)?");
 return;
 }
 await supabaseAdmin.from("answers").update({ status: "ready", transcript: cleaned }).eq("id", ans.id);
 try { await scoreAnswerInternal(ans.id, cleaned); } catch (e) { console.error("score failed", e); }
 } catch (e) {
 console.error("media processing failed", e);
 await supabaseAdmin.from("answers").update({ status: "failed", error_message: e instanceof Error ? e.message : "Erro"}).eq("id", ans.id);
 await sendMessage(chat_id, "Tive um problema ao processar sua mídia. Pode tentar novamente?");
 return;
 }
 } else {
 // text-only: score in background
 try { await scoreAnswerInternal(ans.id, opts.transcript ?? ""); } catch (e) { console.error("score failed", e); }
 }

 await advance(chat_id, interview_id);
}

async function handleMessage(message: TgMessage) {
 const chat_id = message.chat.id;
 const text = (message.text ?? "").trim();

 // Commands
 if (text.startsWith("/start")) {
 const payload = text.slice(6).trim(); // "/start <slug>"
 if (!payload) {
 await sendMessage(chat_id, "Olá! 👋 Para participar de uma pesquisa, abra o link compartilhado pelo pesquisador.");
 return;
 }
 await startInterviewForChat(chat_id, payload, message.from);
 return;
 }
 if (text === "/cancelar"|| text === "/cancel") {
 await upsertSession(chat_id, { state: "idle", interview_id: null, study_id: null, awaiting_consent: false, pending_question_id: null, pending_question_text: null });
 await sendMessage(chat_id, "Entrevista cancelada. Até logo!");
 return;
 }
 if (text === "/ajuda"|| text === "/help") {
 await sendMessage(chat_id, "Comandos:\n/start &lt;link&gt; — iniciar pesquisa\n/cancelar — sair da pesquisa atual");
 return;
 }

 const session = await getSession(chat_id);
 if (!session) {
 await sendMessage(chat_id, "Não encontrei uma pesquisa ativa para você. Use o link compartilhado pelo pesquisador para começar.");
 return;
 }

 // Awaiting consent
 if (session.awaiting_consent || session.state === "awaiting_consent") {
 if (/^sim\b/i.test(text)) {
 await createInterviewAndStart(chat_id, session);
 } else if (/^(n[ãa]o|nao)\b/i.test(text)) {
 await upsertSession(chat_id, { state: "idle", awaiting_consent: false, study_id: null });
 await sendMessage(chat_id, "Tudo bem — sem problemas. Você pode voltar quando quiser.");
 } else {
 await sendMessage(chat_id, "Responda <b>SIM</b> para começar, ou /cancelar para sair.");
 }
 return;
 }

 if (!session.interview_id || !session.pending_question_id) {
 await sendMessage(chat_id, "Não há pergunta pendente. Use o link compartilhado pelo pesquisador para iniciar uma nova pesquisa.");
 return;
 }

 // Voice / audio / video / video_note
 const media = message.voice ?? message.audio ?? message.video_note ?? message.video;
 if (media) {
 await sendChatAction(chat_id, "typing");
 try {
 const blob = await downloadTelegramFile(media.file_id);
 await recordAnswer(chat_id, session, { mediaBlob: blob, duration: media.duration });
 } catch (e) {
 console.error("download failed", e);
 await sendMessage(chat_id, "Não consegui baixar sua mídia. Pode tentar novamente?");
 }
 return;
 }

 // Text answer
 if (text.length > 0) {
 if (text.length < 2) {
 await sendMessage(chat_id, "Sua resposta ficou muito curta. Pode desenvolver um pouco mais?");
 return;
 }
 await recordAnswer(chat_id, session, { transcript: text });
 return;
 }

 await sendMessage(chat_id, "Envie sua resposta como texto, áudio ou vídeo.");
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
 server: {
 handlers: {
 POST: async ({ request }) => {
 // Config guard — fail loudly before the Telegram try/catch (which always
 // returns 200 to suppress retries), so misconfiguration is clearly visible.
 if (!process.env.TELEGRAM_API_KEY) {
 console.error("[telegram-webhook] TELEGRAM_API_KEY is not configured");
 return new Response("Internal Server Error", { status: 500 });
 }
 try {
 const expectedSecret = deriveTelegramWebhookSecret();
 const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
 if (!safeEqualString(actual, expectedSecret)) {
 return new Response("Unauthorized", { status: 401 });
 }

 const update = await request.json();
 const message: TgMessage | undefined = update.message ?? update.edited_message;
 if (!message?.chat?.id || typeof update.update_id !== "number") {
 return Response.json({ ok: true, ignored: true });
 }

 // Idempotency: skip if we've already seen this update for this chat
 const { data: existing } = await supabaseAdmin
 .from("telegram_sessions")
 .select("last_update_id")
 .eq("chat_id", message.chat.id)
 .maybeSingle();
 if (existing?.last_update_id && existing.last_update_id >= update.update_id) {
 return Response.json({ ok: true, duplicate: true });
 }
 await upsertSession(message.chat.id, { last_update_id: update.update_id });

 // Process — respond to Telegram quickly; errors logged.
 await handleMessage(message);
 return Response.json({ ok: true });
 } catch (e) {
 console.error("[telegram-webhook] error", e);
 // Always return 200 so Telegram does not retry indefinitely.
 return Response.json({ ok: false, error: e instanceof Error ? e.message : "unknown"});
 }
 },
 },
 },
});
