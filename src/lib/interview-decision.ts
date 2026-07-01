// Pure interview-flow decision — no I/O, no Supabase. Given the interview's
// questions and answers (already fetched), it decides the next step as a
// discriminated union. `computeNextStep` (interview.functions.ts) is the thin
// shell that fetches the rows and injects the AI follow-up generator.
//
// The AI is injected via `askFollowup` so this stays deterministic and testable —
// the heart of the interview loop can be refactored with a safety net (see
// interview-decision.test.ts).

export type NextStep =
  | { type: "done" }
  | { type: "processing" }
  | { type: "question"; question_id: string; text: string; intent: string; position: number }
  | {
      type: "followup";
      question_id: string;
      text: string;
      intent: string;
      parent_answer_id: string | null;
      position: number;
    };

export type DecisionQuestion = {
  id: string;
  text: string;
  intent: string | null;
  position: number;
};

export type DecisionAnswer = {
  id: string;
  question_id: string | null;
  is_followup: boolean;
  parent_answer_id: string | null;
  transcript: string | null;
  question_text: string;
  status: string;
};

export type FollowupCtx = {
  studyContext: string;
  originalQuestion: string;
  originalIntent: string;
  transcripts: string;
  previousFollowups: string;
  followupsRemaining: number;
};

export async function decideNextStep(input: {
  interviewStatus: string;
  questions: DecisionQuestion[];
  answers: DecisionAnswer[];
  maxFollowups: number;
  studyContext: string;
  askFollowup: (ctx: FollowupCtx) => Promise<string | null>;
}): Promise<NextStep> {
  const {
    interviewStatus,
    questions,
    answers: ans,
    maxFollowups,
    studyContext,
    askFollowup,
  } = input;

  if (interviewStatus === "completed") return { type: "done" };

  for (const q of questions) {
    // Ignore failed answers: respondent will be prompted again for the same question/followup.
    const forQ = ans.filter((a) => a.question_id === q.id && a.status !== "failed");
    if (forQ.length === 0) {
      return {
        type: "question",
        question_id: q.id,
        text: q.text,
        intent: q.intent ?? "",
        position: q.position,
      };
    }
    const ready = forQ.filter((a) => a.status === "ready" && a.transcript);
    if (ready.length < forQ.length) {
      // still processing (uploading/transcribing — not failed)
      return { type: "processing" };
    }
    // If the latest answer for this question was a failed followup, re-ask it.
    const allForQ = ans.filter((a) => a.question_id === q.id);
    const lastForQ = allForQ[allForQ.length - 1];
    if (lastForQ && lastForQ.status === "failed" && lastForQ.is_followup) {
      return {
        type: "followup",
        question_id: q.id,
        text: lastForQ.question_text,
        intent: q.intent ?? "",
        parent_answer_id: lastForQ.parent_answer_id ?? null,
        position: q.position,
      };
    }
    const followups = forQ.filter((a) => a.is_followup);
    if (followups.length < maxFollowups) {
      // ask AI if a followup is needed
      const lastAnswer = forQ[forQ.length - 1];
      const previousFollowups = followups
        .map((f) => `- Pergunta: ${f.question_text}\n  Resposta: ${f.transcript}`)
        .join("\n");
      const transcripts = forQ
        .map(
          (a) =>
            `[${a.is_followup ? "Follow-up" : "Original"}] ${a.question_text}\n→ ${a.transcript}`,
        )
        .join("\n\n");
      const fu = await askFollowup({
        studyContext,
        originalQuestion: q.text,
        originalIntent: q.intent ?? "",
        transcripts,
        previousFollowups,
        followupsRemaining: maxFollowups - followups.length,
      });
      if (fu) {
        return {
          type: "followup",
          question_id: q.id,
          text: fu,
          intent: q.intent ?? "",
          parent_answer_id: lastAnswer.id,
          position: q.position,
        };
      }
    }
    // move on
  }
  // all questions handled
  return { type: "done" };
}
