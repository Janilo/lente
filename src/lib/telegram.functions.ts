import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBotUsername } from "./telegram.server";

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
