/**
 * Lightweight HTTP error with an attached status code.
 *
 * Services throw these so controllers can map them to the right response code
 * without sniffing message strings. Any non-HttpError thrown by a service is
 * treated as a 500 by controllers.
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** 400 — malformed / invalid input. */
export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = "ValidationError";
  }
}

/** 403 — authenticated but not allowed (e.g. not an org_admin). */
export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

/** 404 — resource does not exist (or is soft-deleted / not a member). */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/** 409 — conflict (e.g. already a member, last org_admin, join code collision). */
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
    this.name = "ConflictError";
  }
}
