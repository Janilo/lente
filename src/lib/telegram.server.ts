// Telegram Bot API helpers via Lovable connector gateway.
import { createHash, timingSafeEqual } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function getKeys() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");
  return { LOVABLE_API_KEY, TELEGRAM_API_KEY };
}

export function deriveTelegramWebhookSecret(): string {
  const { TELEGRAM_API_KEY } = getKeys();
  return createHash("sha256").update(`telegram-webhook:${TELEGRAM_API_KEY}`).digest("base64url");
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function tg<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const { LOVABLE_API_KEY, TELEGRAM_API_KEY } = getKeys();
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Telegram ${method} failed [${res.status}]: ${JSON.stringify(data)}`);
  return data as T;
}

export async function sendMessage(chat_id: number, text: string, extra: Record<string, unknown> = {}) {
  return tg("sendMessage", { chat_id, text, parse_mode: "HTML", ...extra });
}

export async function sendChatAction(chat_id: number, action: "typing" | "record_voice" | "upload_voice") {
  try {
    await tg("sendChatAction", { chat_id, action });
  } catch { /* non-fatal */ }
}

export async function downloadTelegramFile(file_id: string): Promise<Blob> {
  const { LOVABLE_API_KEY, TELEGRAM_API_KEY } = getKeys();
  const meta = await tg<{ result: { file_path: string } }>("getFile", { file_id });
  const file_path = meta.result.file_path;
  const res = await fetch(`${GATEWAY_URL}/file/${file_path}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
    },
  });
  if (!res.ok) throw new Error(`Telegram file download failed [${res.status}]`);
  return await res.blob();
}

export async function getBotUsername(): Promise<string> {
  const me = await tg<{ result: { username: string } }>("getMe", {});
  return me.result.username;
}
