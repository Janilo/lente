import { describe, it, expect } from "vitest";
import {
  assertInterviewRespondent,
  assertRowAnswerStudyOwner,
  assertRowInterviewRespondent,
  assertRowOwner,
  assertRowRespondentOrStudyOwner,
  assertRowStudyOwner,
  assertStudyOwner,
} from "./authz";
import { ForbiddenError } from "./errors";

// Fake mínimo da corrente from().select().eq().maybeSingle() dos asserts fetch-style.
function fakeDb(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    }),
  } as unknown as Parameters<typeof assertStudyOwner>[0];
}

describe("asserts fetch-style (F-A0)", () => {
  it("assertStudyOwner: dono passa e recebe a linha; não-dono e linha ausente → 403", async () => {
    const row = { id: "s1", owner_id: "u1", title: "T" };
    await expect(assertStudyOwner(fakeDb(row), "s1", "u1")).resolves.toEqual(row);
    await expect(assertStudyOwner(fakeDb(row), "s1", "u2")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertStudyOwner(fakeDb(null), "s1", "u1")).rejects.toMatchObject({
      status: 403,
      message: "Acesso negado.",
    });
  });

  it("assertInterviewRespondent: respondente passa; outro usuário → 403", async () => {
    const iv = { id: "i1", study_id: "s1", respondent_id: "r1" };
    await expect(assertInterviewRespondent(fakeDb(iv), "i1", "r1")).resolves.toEqual(iv);
    await expect(assertInterviewRespondent(fakeDb(iv), "i1", "r2")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("asserts de linha já buscada (row variants)", () => {
  it("assertRowOwner: dono passa; não-dono e linha ausente → 403 (sem vazar existência)", () => {
    expect(() => assertRowOwner({ owner_id: "u1" }, "u1")).not.toThrow();
    expect(() => assertRowOwner({ owner_id: "u1" }, "u2")).toThrow(ForbiddenError);
    expect(() => assertRowOwner(null, "u1")).toThrow(ForbiddenError);
  });

  it("assertRowStudyOwner: checa o dono via join; studies nulo conta como negado", () => {
    expect(() => assertRowStudyOwner({ studies: { owner_id: "u1" } }, "u1")).not.toThrow();
    expect(() => assertRowStudyOwner({ studies: { owner_id: "u1" } }, "u2")).toThrow(
      ForbiddenError,
    );
    expect(() => assertRowStudyOwner({ studies: null }, "u1")).toThrow(ForbiddenError);
    expect(() => assertRowStudyOwner(null, "u1")).toThrow(ForbiddenError);
  });

  it("assertRowInterviewRespondent: respondente do join passa; outro → 403", () => {
    expect(() =>
      assertRowInterviewRespondent({ interviews: { respondent_id: "r1" } }, "r1"),
    ).not.toThrow();
    expect(() =>
      assertRowInterviewRespondent({ interviews: { respondent_id: "r1" } }, "r2"),
    ).toThrow(ForbiddenError);
    expect(() => assertRowInterviewRespondent({ interviews: null }, "r1")).toThrow(ForbiddenError);
  });

  it("assertRowAnswerStudyOwner: dono via join duplo; qualquer nível nulo → 403", () => {
    const ans = { interviews: { studies: { owner_id: "u1" } } };
    expect(() => assertRowAnswerStudyOwner(ans, "u1")).not.toThrow();
    expect(() => assertRowAnswerStudyOwner(ans, "u2")).toThrow(ForbiddenError);
    expect(() => assertRowAnswerStudyOwner({ interviews: null }, "u1")).toThrow(ForbiddenError);
    expect(() => assertRowAnswerStudyOwner({ interviews: { studies: null } }, "u1")).toThrow(
      ForbiddenError,
    );
  });

  it("assertRowRespondentOrStudyOwner: respondente OU dono do estudo passam; terceiros não", () => {
    const iv = { respondent_id: "r1", studies: { owner_id: "u1" } };
    expect(() => assertRowRespondentOrStudyOwner(iv, "r1")).not.toThrow();
    expect(() => assertRowRespondentOrStudyOwner(iv, "u1")).not.toThrow();
    expect(() => assertRowRespondentOrStudyOwner(iv, "x")).toThrow(ForbiddenError);
    expect(() => assertRowRespondentOrStudyOwner(null, "r1")).toThrow(ForbiddenError);
  });
});
