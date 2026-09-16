import type { Response } from "express";
import { AppError, NotFoundError } from "./AppError";

/** Preserve status codes without exposing SDK errors or their request credentials. */
export function respondToAuthError(res: Response, error: unknown): void {
  if (error instanceof NotFoundError) {
    res.status(401).json({ message: "Account not found. Please complete sign up.", code: "AUTH_ACCOUNT_MISSING" });
  } else if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
  } else {
    console.error("Authentication operation failed");
    res.status(500).json({ message: "Authentication service is temporarily unavailable. Please try again." });
  }
}
