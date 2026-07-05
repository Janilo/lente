// Typed domain errors — canonical module, kept identical across the apps
// (site / lente / prisma / cascata). Business and server code throws these
// instead of a bare `throw new Error("string")`, so the request boundary and
// the client can tell 401 / 403 / 404 / 422 apart from a generic 500 by TYPE,
// and so `message` is known to be safe to show the user.
//
// Serialization boundary (why the `appError` marker): TanStack server functions
// serialize thrown errors with seroval, which preserves own enumerable props
// (`appError`, `status`, `code`, `name`) but NOT the class prototype. On the
// client the error arrives as a plain Error carrying those props — so code that
// runs after the wire uses `isAppError(e)` / `userMessageFrom(e)` / `appErrorCode(e)`,
// never `e instanceof AppError`.
//
// Invariant: `message` IS the user-facing message. Internal detail (SQL error,
// missing env var, stack) goes to console.error at the throw site, never here.
//
// App-specific error codes/subclasses (e.g. cascata's share-link codes) build
// on top of this module; the base AppError + helpers below are the shared part.

export class AppError extends Error {
  /** Own enumerable marker that survives the serverFn serialization boundary. */
  readonly appError = true;
  /** HTTP-ish status; the request boundary maps it to the response status. */
  readonly status: number;
  /** Optional domain code, for clients that react to *which* failure happened. */
  readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

/** Caller is not authenticated (401). */
export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado. Faça login novamente.", code?: string) {
    super(message, 401, code);
  }
}

/** Authenticated but not allowed (403). */
export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.", code?: string) {
    super(message, 403, code);
  }
}

/** Resource does not exist, or is not visible to the caller (404). */
export class NotFoundError extends AppError {
  constructor(message = "Não encontrado.", code?: string) {
    super(message, 404, code);
  }
}

/** Input is well-formed but violates a domain precondition (422). */
export class ValidationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 422, code);
  }
}

/** Server-side configuration is missing/invalid (500) — operator problem, not user. */
export class ConfigError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 500, code);
  }
}

/** True for a live AppError OR its deserialized shape (plain Error + marker). */
export function isAppError(e: unknown): boolean {
  if (e instanceof AppError) return true;
  return e != null && typeof e === "object" && (e as { appError?: unknown }).appError === true;
}

/**
 * The message that is safe to render, or undefined for non-domain errors —
 * callers show a generic fallback (and log the original).
 */
export function userMessageFrom(e: unknown): string | undefined {
  if (!isAppError(e)) return undefined;
  const msg = (e as { message?: unknown }).message;
  return typeof msg === "string" && msg.length > 0 ? msg : undefined;
}

/** The domain code (if any), on either side of the serverFn boundary. */
export function appErrorCode(e: unknown): string | undefined {
  if (!isAppError(e)) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Map a thrown error to a JSON error Response, or null when it isn't an
 * AppError (caller decides — usually rethrow). 5xx bodies get a generic
 * message; the precise one (env var names, internals) stays in the server log.
 */
export function toErrorResponse(error: unknown): Response | null {
  if (!isAppError(error)) return null;
  const status = (error as AppError).status ?? 500;
  if (status >= 500) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status });
  }
  return Response.json({ error: (error as Error).message }, { status });
}
