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

/**
 * Sign a short-lived, opaque state token tying an OAuth redirect to a user.
 * Used for the Google Calendar OAuth flow: the browser can't send the auth
 * header on the redirect, so we pass this signed token through the `state`
 * param and verify it in the callback to recover the uid. An optional
 * `returnTo` path is carried along so the caller can control where the browser
 * lands after consent (e.g. back into an onboarding wizard).
 */
export function signStateToken(uid: string, returnTo?: string): string {
  const payload: { uid: string; r?: string } = { uid };
  if (returnTo) payload.r = returnTo;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

/** Payload returned by {@link verifyStateToken}. */
export interface StateTokenPayload {
  uid: string;
  returnTo: string | null;
}

/**
 * Verify a state token and return the embedded uid (+ returnTo path), or null
 * if invalid.
 */
export function verifyStateToken(
  token: string | undefined,
): StateTokenPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      uid?: string;
      r?: string;
    };
    if (!decoded.uid) return null;
    return {
      uid: decoded.uid,
      returnTo: typeof decoded.r === "string" ? decoded.r : null,
    };
  } catch {
    return null;
  }
}

/**
 * Sign a short-lived RSVP token for a lesson invite email. Students aren't
 * users in the system (no auth), so the Accept/Decline buttons in the email
 * carry this signed token instead. It binds the link to a specific lesson
 * and a version; bumping the version on resend invalidates old links.
 *
 * Expiry is generous (30 days) so a student can respond well after the
 * initial reminder; a resend always supersedes prior links via the version.
 */
export function signRsvpToken(lessonId: string, version: number): string {
  return jwt.sign({ lid: lessonId, v: version }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

/** RSVP token payload returned by {@link verifyRsvpToken}. */
export interface RsvpTokenPayload {
  lessonId: string;
  version: number;
}

/**
 * Verify an RSVP token. Returns the lesson id + version, or null if the
 * token is missing, malformed, or expired. The caller must additionally
 * check that `version` matches the lesson's current `rsvpTokenVersion`.
 */
export function verifyRsvpToken(
  token: string | undefined
): RsvpTokenPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      lid?: string;
      v?: number;
    };
    if (!decoded.lid || typeof decoded.v !== "number") return null;
    return { lessonId: decoded.lid, version: decoded.v };
  } catch {
    return null;
  }
}
