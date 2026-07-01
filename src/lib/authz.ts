import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ForbiddenError } from "./errors";

type Db = SupabaseClient<Database>;

// Single owner of the resource-authorization rules that were previously inlined
// (and duplicated ~26×) across the serverFns. Each assert runs the same lookup +
// ownership check, returns the resource (callers skip a second fetch), and throws
// ForbiddenError ("Acesso negado.", unchanged) when the caller is not the
// owner/respondent — including when the row is missing, to avoid leaking existence.
//
// The caller passes its OWN client so the RLS-vs-service-role choice per call site
// is preserved exactly (see F-A4): pass `context.supabase` for RLS-scoped reads,
// `supabaseAdmin` where the handler legitimately bypasses RLS. Changing "who can
// read/write this study/interview" now happens in one place.

/** The interview must belong to `userId` (the respondent). */
export async function assertInterviewRespondent(db: Db, interviewId: string, userId: string) {
  const { data: iv } = await db
    .from("interviews")
    .select("id, study_id, respondent_id")
    .eq("id", interviewId)
    .maybeSingle();
  if (!iv || iv.respondent_id !== userId) throw new ForbiddenError();
  return iv;
}

/** The study must be owned by `userId` (the researcher). */
export async function assertStudyOwner(db: Db, studyId: string, userId: string) {
  const { data: study } = await db
    .from("studies")
    .select("id, owner_id, title")
    .eq("id", studyId)
    .maybeSingle();
  if (!study || study.owner_id !== userId) throw new ForbiddenError();
  return study;
}
