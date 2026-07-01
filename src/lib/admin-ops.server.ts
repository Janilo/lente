// The single place that reaches for service-role-only powers: `auth.admin` (looking
// up a user's email by id) and Storage signed URLs. These have NO RLS-client
// equivalent — they legitimately require supabaseAdmin — so concentrating them here
// (F-A4) keeps that dangerous surface behind a narrow, named interface instead of
// scattering `supabaseAdmin.auth.admin` / `.storage` across the slices.
//
// Callers must still authorize the request first (see authz.ts); these helpers only
// perform the privileged read once the caller has decided it is allowed.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "interview-videos";

/**
 * A user's email + auth-metadata display name by id — service-role only (no RLS
 * equivalent). Both null on miss/error. This is the ONE place `auth.admin.getUserById`
 * is called; every other slice goes through this module.
 */
export async function adminGetUserContact(
  userId: string,
): Promise<{ email: string | null; fullName: string | null }> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return {
      email: data?.user?.email ?? null,
      fullName: (data?.user?.user_metadata?.full_name as string | null | undefined) ?? null,
    };
  } catch {
    return { email: null, fullName: null };
  }
}

/** A user's email by id — service-role only (no RLS equivalent). Null on miss/error. */
export async function adminGetUserEmail(userId: string): Promise<string | null> {
  return (await adminGetUserContact(userId)).email;
}

/** Time-limited signed URL for one interview video. Null on miss. */
export async function signedVideoUrl(
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

/** Batch signed URLs for interview videos, keyed by storage path. */
export async function signedVideoUrls(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}
