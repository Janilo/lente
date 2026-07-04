// Typed domain/authorization errors, so the HTTP boundary and clients can tell
// 403 / 404 / 422 apart from a generic 500 by *type* instead of by matching PT-BR
// strings. Messages are preserved from the previous inline `throw new Error("…")`
// calls, so any existing message-based handling keeps working.
//
// The request boundary (start.ts errorMiddleware) maps `AppError.status` to the
// HTTP status of the response — a ForbiddenError surfaces as 403, not 500.
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Não encontrado.") {
    super(message, 404);
  }
}

export class DomainError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}
