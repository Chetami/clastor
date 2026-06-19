import jwt from "jsonwebtoken";
import { JwtPayload, Role } from "@examify-tms/interfaces";

/**
 * JWT utility functions
 */

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRY = "1h";

/**
 * Generate a JWT token for a user
 */
export function generateToken(uid: string, email: string, role: Role): string {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    uid,
    email,
    role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new Error("No authorization header provided");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid authorization header format");
  }

  return authHeader.substring(7);
}
