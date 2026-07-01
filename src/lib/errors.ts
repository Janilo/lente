// Typed domain/authorization errors, so the HTTP boundary and clients can tell
// 403 / 404 / 422 apart from a generic 500 by *type* instead of by matching PT-BR
// strings. Messages are preserved from the previous inline `throw new Error("…")`
// calls, so any existing message-based handling keeps working.
//
// Follow-up: map `AppError.status` in the request boundary (start.ts) so these
// surface as the right HTTP status. Introducing the classes first (this file) is
// safe on its own — an AppError behaves like a normal Error until then.
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
