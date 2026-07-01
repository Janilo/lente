import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminGetUserContact } from "./admin-ops.server";
import { syncContact } from "./hubspot.server";

// Called from /signup after a successful signup (email or Google).
// Authenticated: uses the current user's email + profile.
export const syncHubspotSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: z.enum(["researcher", "respondent"]),
        study_slug: z.string().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {
      const contact = await adminGetUserContact(userId);
      const email = contact.email;
      if (!email) return { ok: false, reason: "no_email" };

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      let study: { id: string; title: string; slug: string } | null = null;
      if (data.study_slug) {
        const { data: s } = await supabaseAdmin
          .from("studies")
          .select("id, title, public_slug")
          .eq("public_slug", data.study_slug)
          .maybeSingle();
        if (s) study = { id: s.id, title: s.title, slug: s.public_slug };
      }

      await syncContact({
        email,
        full_name: profile?.full_name ?? contact.fullName,
        role: data.role,
        study,
      });
      return { ok: true };
    } catch (e) {
      console.warn("[hubspot] syncHubspotSelf error:", e);
      return { ok: false };
    }
  });
