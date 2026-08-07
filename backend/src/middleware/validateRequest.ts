import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";
import { ApiError } from "@examify-tms/interfaces";

/**
 * The subset(s) of a request a schema can validate.
 *
 * Each value is a Zod schema; the parsed (and unknown-key-stripped) result is
 * written back onto `req.params` / `req.query` / `req.body` so downstream
 * handlers operate on trusted, well-typed data.
 */
export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Format a ZodError into a stable serialisable shape for the client.
 */
export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Middleware factory: validates `params`, `query`, then `body` against the
 * supplied Zod schemas. On the first parse failure it short-circuits with a
 * structured 400 response. On success the parsed values replace the raw
 * request fields and the chain continues.
 *
 * Unknown keys are stripped (Zod's default), which also guards against
 * mass-assignment into Firestore.
 */
export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, res: Response<ApiError>, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          message: "Validation failed",
          errors: formatZodError(error),
        } as unknown as ApiError);
        return;
      }
      next(error);
    }
  };
}
