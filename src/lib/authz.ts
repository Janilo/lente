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

// ── Row variants ────────────────────────────────────────────────────────────
// For handlers that already fetched the resource via a joined select (the row
// carries fields the handler needs next): the fetch stays in the slice, the
// ownership PREDICATE lives here. A missing row counts as denied — no
// existence leak. Assertion signatures keep the caller's narrowing (`row` is
// non-null after the call).

/** The fetched row must be owned by `userId` (`row.owner_id`). */
export function assertRowOwner<T extends { owner_id: string | null }>(
  row: T | null | undefined,
  userId: string,
): asserts row is T {
  if (!row || row.owner_id !== userId) throw new ForbiddenError();
}

/** The fetched interview-ish row must belong to a study owned by `userId` (`row.studies.owner_id`). */
export function assertRowStudyOwner<T extends { studies: { owner_id: string } | null }>(
  row: T | null | undefined,
  userId: string,
): asserts row is T {
  if (!row || row.studies?.owner_id !== userId) throw new ForbiddenError();
}

/** The fetched answer-ish row must belong to the respondent `userId` (`row.interviews.respondent_id`). */
export function assertRowInterviewRespondent<
  T extends { interviews: { respondent_id: string } | null },
>(row: T | null | undefined, userId: string): asserts row is T {
  if (!row || row.interviews?.respondent_id !== userId) throw new ForbiddenError();
}

/** The fetched answer-ish row must belong to a study owned by `userId` (`row.interviews.studies.owner_id`). */
export function assertRowAnswerStudyOwner<
  T extends { interviews: { studies: { owner_id: string } | null } | null },
>(row: T | null | undefined, userId: string): asserts row is T {
  if (!row || row.interviews?.studies?.owner_id !== userId) throw new ForbiddenError();
}

/** The fetched interview row must belong to `userId` as respondent OR study owner. */
export function assertRowRespondentOrStudyOwner<
  T extends { respondent_id: string; studies: { owner_id: string } | null },
>(row: T | null | undefined, userId: string): asserts row is T {
  if (!row) throw new ForbiddenError();
  if (row.respondent_id !== userId && row.studies?.owner_id !== userId) {
    throw new ForbiddenError();
  }
}
