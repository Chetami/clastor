import { Request, Response, NextFunction } from "express";
import { verifyToken, extractToken } from "../utils/jwt";
import { JwtPayload, Role } from "@examify-tms/interfaces";

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
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
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
  return (req: Request, res: Response, next: NextFunction) => {
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
