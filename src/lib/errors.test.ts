import { describe, it, expect } from "vitest";

import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConfigError,
  isAppError,
  userMessageFrom,
  appErrorCode,
  toErrorResponse,
} from "./errors";

describe("AppError", () => {
  it("carries a status, defaulting to 500", () => {
    expect(new AppError("x").status).toBe(500);
    expect(new AppError("x", 418).status).toBe(418);
  });

  it("subclasses carry their canonical status", () => {
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ValidationError("bad").status).toBe(422);
    expect(new ConfigError("missing").status).toBe(500);
  });

  it("names itself after the concrete subclass", () => {
    expect(new ForbiddenError().name).toBe("ForbiddenError");
    expect(new AppError("x").name).toBe("AppError");
  });

  it("carries an optional domain code", () => {
    expect(new NotFoundError("no", "LINK_INVALID").code).toBe("LINK_INVALID");
    expect(new AppError("x").code).toBeUndefined();
  });
});

describe("boundary helpers work on both a live error and its serialized shape", () => {
  it("isAppError recognizes a live AppError, rejects plain errors", () => {
    expect(isAppError(new ForbiddenError())).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("nope")).toBe(false);
  });

  it("isAppError recognizes the deserialized shape (plain object + marker)", () => {
    const wire = { appError: true, status: 403, code: "X", message: "no" };
    expect(isAppError(wire)).toBe(true);
    expect(userMessageFrom(wire)).toBe("no");
    expect(appErrorCode(wire)).toBe("X");
  });

  it("userMessageFrom returns undefined for non-domain errors", () => {
    expect(userMessageFrom(new Error("secret internal detail"))).toBeUndefined();
    expect(userMessageFrom(new ForbiddenError("Acesso negado."))).toBe("Acesso negado.");
  });

  it("appErrorCode returns undefined when there is no code", () => {
    expect(appErrorCode(new ForbiddenError())).toBeUndefined();
  });
});

describe("toErrorResponse", () => {
  it("returns null for non-AppErrors so the caller can rethrow", () => {
    expect(toErrorResponse(new Error("x"))).toBeNull();
  });

  it("passes 4xx messages through to the body", async () => {
    const res = toErrorResponse(new ForbiddenError("nope"))!;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("masks 5xx messages behind a generic body", async () => {
    const res = toErrorResponse(new ConfigError("SUPABASE_URL missing"))!;
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
