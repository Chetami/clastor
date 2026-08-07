/**
 * Base class for application errors that carry an explicit HTTP status code.
 *
 * Throw one of the subclasses (or `AppError` directly) from a controller or
 * service and the central error handler in `server.ts` will map it to the
 * correct status — no more string-matching on `error.message` to pick a code.
 *
 * The generic "Failed to X" infrastructure errors stay as plain `Error`s and
 * continue to surface as 500s.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 400 — the request body/query/params are semantically invalid. */
export class BadRequestError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code);
    this.name = "BadRequestError";
  }
}

/** 401 — authentication is missing or invalid. */
export class UnauthorizedError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 401, code);
    this.name = "UnauthorizedError";
  }
}

/** 403 — authenticated but not allowed to perform this action. */
export class ForbiddenError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 403, code);
    this.name = "ForbiddenError";
  }
}

/** 404 — the referenced resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 404, code);
    this.name = "NotFoundError";
  }
}

/** 409 — the request conflicts with the current resource state. */
export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 409, code);
    this.name = "ConflictError";
  }
}

/** 503 — a required dependency (SMTP, Stripe, OAuth) is not configured. */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 503, code);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Type guard for {@link AppError}. Useful in `instanceof`-averse code paths
 * (e.g. across module boundaries where the class identity is preserved).
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
