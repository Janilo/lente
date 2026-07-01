import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBotUsername, deriveTelegramWebhookSecret, tg } from "./telegram.server";
import { ADMIN_EMAIL } from "./config";

// URL pública do receptor de webhook do bot (produção).
const TELEGRAM_WEBHOOK_URL = "https://lente.pereirasaraiva.com/api/public/telegram/webhook";

function assertAdmin(claims: { email?: string } | undefined) {
  if ((claims?.email ?? "").toLowerCase() !== ADMIN_EMAIL) throw new Error("Acesso negado.");
}

let cachedBotUsername: { value: string; expiresAt: number } | null = null;

// Returns t.me deep link for sharing a study via the Telegram bot.
export const getTelegramShareLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ study_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: study } = await supabaseAdmin
      .from("studies").select("id, owner_id, public_slug, status").eq("id", data.study_id).maybeSingle();
    if (!study || study.owner_id !== userId) throw new Error("Acesso negado.");

    const now = Date.now();
    let username = cachedBotUsername && cachedBotUsername.expiresAt > now ? cachedBotUsername.value : null;
    if (!username) {
      try {
        username = await getBotUsername();
        cachedBotUsername = { value: username, expiresAt: now + 60 * 60 * 1000 };
      } catch (e) {
        throw new Error("Não consegui obter o nome do bot. Verifique a conexão Telegram.");
      }
    }
    return {
      url: `https://t.me/${username}?start=${study.public_slug}`,
      bot_username: username,
      published: study.status === "published",
    };
  });

type TelegramWebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
};

// Admin: status atual do webhook do bot, comparado com o URL esperado.
export const getTelegramWebhookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const info = await tg<{ result: TelegramWebhookInfo }>("getWebhookInfo", {});
    const currentUrl = info.result?.url ?? "";
    return {
      expectedUrl: TELEGRAM_WEBHOOK_URL,
      currentUrl,
      matches: currentUrl === TELEGRAM_WEBHOOK_URL,
      pendingUpdates: info.result?.pending_update_count ?? 0,
      lastErrorMessage: info.result?.last_error_message ?? null,
    };
  });

// Admin: registra/atualiza o webhook do bot pro domínio de produção (com secret token).
export const registerTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as { email?: string });
    const secret_token = deriveTelegramWebhookSecret();
    await tg("setWebhook", {
      url: TELEGRAM_WEBHOOK_URL,
      secret_token,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: false,
    });
    const info = await tg<{ result: TelegramWebhookInfo }>("getWebhookInfo", {});
    return {
      ok: true,
      url: TELEGRAM_WEBHOOK_URL,
      currentUrl: info.result?.url ?? "",
      pendingUpdates: info.result?.pending_update_count ?? 0,
    };
  });
