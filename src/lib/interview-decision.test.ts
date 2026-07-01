import { describe, it, expect } from "vitest";
import { decideNextStep, type DecisionAnswer, type DecisionQuestion } from "./interview-decision";

const noFollowup = async () => null;
const yesFollowup = async () => "Pode detalhar?";

const Q1: DecisionQuestion = { id: "q1", text: "Como foi?", intent: "abrir", position: 1 };

function ans(o: Partial<DecisionAnswer> & { id: string; status: string }): DecisionAnswer {
  return {
    question_id: "q1",
    is_followup: false,
    parent_answer_id: null,
    transcript: null,
    question_text: "Como foi?",
    ...o,
  };
}

describe("decideNextStep", () => {
  it("interview completa → done", async () => {
    const r = await decideNextStep({
      interviewStatus: "completed",
      questions: [Q1],
      answers: [],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: noFollowup,
    });
    expect(r).toEqual({ type: "done" });
  });

  it("sem respostas → primeira pergunta", async () => {
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: noFollowup,
    });
    expect(r).toEqual({
      type: "question",
      question_id: "q1",
      text: "Como foi?",
      intent: "abrir",
      position: 1,
    });
  });

  it("resposta ainda transcrevendo → processing", async () => {
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [ans({ id: "a1", status: "transcribing" })],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: noFollowup,
    });
    expect(r).toEqual({ type: "processing" });
  });

  it("último answer é followup falho → re-pergunta o followup", async () => {
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [
        ans({ id: "a1", status: "ready", transcript: "resposta" }),
        ans({
          id: "a2",
          status: "failed",
          is_followup: true,
          parent_answer_id: "a1",
          question_text: "Detalhe?",
        }),
      ],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: noFollowup,
    });
    expect(r).toEqual({
      type: "followup",
      question_id: "q1",
      text: "Detalhe?",
      intent: "abrir",
      parent_answer_id: "a1",
      position: 1,
    });
  });

  it("resposta pronta + IA sugere followup → followup gerado", async () => {
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [ans({ id: "a1", status: "ready", transcript: "resposta" })],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: yesFollowup,
    });
    expect(r).toEqual({
      type: "followup",
      question_id: "q1",
      text: "Pode detalhar?",
      intent: "abrir",
      parent_answer_id: "a1",
      position: 1,
    });
  });

  it("resposta pronta + IA não sugere → done", async () => {
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [ans({ id: "a1", status: "ready", transcript: "resposta" })],
      maxFollowups: 2,
      studyContext: "",
      askFollowup: noFollowup,
    });
    expect(r).toEqual({ type: "done" });
  });

  it("followups esgotados → não chama a IA e segue para done", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return "x";
    };
    const r = await decideNextStep({
      interviewStatus: "in_progress",
      questions: [Q1],
      answers: [
        ans({ id: "a1", status: "ready", transcript: "orig" }),
        ans({
          id: "a2",
          status: "ready",
          transcript: "fu1",
          is_followup: true,
          parent_answer_id: "a1",
        }),
      ],
      maxFollowups: 1,
      studyContext: "",
      askFollowup: spy,
    });
    expect(r).toEqual({ type: "done" });
    expect(called).toBe(false);
  });
});
