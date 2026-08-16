import { Request, Response, NextFunction } from "express";
import { verifyToken, extractToken } from "../utils/jwt";
import { JwtPayload, Role, ApiError } from "@examify-tms/interfaces";
import { getFirebaseAuth } from "../config/firebase";

/**
 * Extend Express Request to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticateJWT(req: Request, res: Response<ApiError>, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: error instanceof Error ? error.message : "Invalid token",
    });
  }
}

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has required role
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response<ApiError>, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have sufficient permissions",
      });
    }

    next();
  };
}

/**
 * Require system admin role
 */
export const requireSystemAdmin = requireRole("system_admin");

/**
 * Require tutor role
 */
export const requireTutor = requireRole("tutor");

/**
 * Email-verification gate for actions that reach other people or external
 * systems (emails to students, invoices, Google Calendar/Meet writes). Checks
 * Firebase Auth live rather than trusting a JWT claim, so a user who just
 * clicked the verification link is let through immediately without waiting
 * for a token refresh. Responses carry a `code: "EMAIL_NOT_VERIFIED"` so
 * clients can react programmatically (e.g. surface the verify-email banner).
 */
export async function requireVerifiedEmail(
  req: Request,
  res: Response<ApiError>,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Access Denied. No token provided." });
    return;
  }

  try {
    const authUser = await getFirebaseAuth().getUser(req.user.uid);
    if (!authUser.emailVerified) {
      res.status(403).json({
        message: "Please verify your email before performing this action.",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }
    next();
  } catch {
    // Firebase lookup failed — fail closed rather than letting an
    // unverifiable user through the gate.
    res.status(401).json({ message: "Could not verify account status" });
  }
}
