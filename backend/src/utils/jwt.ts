import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JwtPayload, Role } from "@examify-tms/interfaces";

/**
 * JWT utility functions
 */

/**
 * Read a required secret from the environment. The server MUST NOT start with a
 * hard-coded/predictable signing key — doing so would let anyone forge access,
 * refresh, RSVP and OAuth-state tokens. Fail loudly at import time instead.
 */
function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is not set. Refusing to start without a secret signing key.`,
    );
  }
  return value;
}

const JWT_SECRET = requireSecret("JWT_SECRET");
const JWT_EXPIRY = "15m";

/**
 * Refresh tokens use a SEPARATE secret from access tokens so a refresh token
 * can never be mistaken for an access token (and vice versa) by the verifier.
 */
const REFRESH_TOKEN_SECRET = requireSecret("REFRESH_TOKEN_SECRET");
const REFRESH_TOKEN_EXPIRY = "30d";

/** Payload embedded in a signed refresh token. */
export interface RefreshTokenPayload {
  uid: string;
  /** Groups all refresh tokens minted from a single login; used for reuse
   * detection (revoking the whole chain when a revoked token is replayed). */
  familyId: string;
  /** Unique id of this token; also the Firestore doc id. */
  jti: string;
}

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
 * Generate a random opaque id (used for token `jti` and `familyId`).
 */
export function generateJti(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Generate a signed refresh token bound to a user, family, and jti.
 */
export function generateRefreshToken(
  uid: string,
  familyId: string,
  jti: string,
): string {
  const payload: RefreshTokenPayload = { uid, familyId, jti };
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify a refresh token's signature and expiry. Returns the decoded payload,
 * or null if invalid/expired. Callers must additionally check the Firestore
 * record (revoked / hash match) before trusting it.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
    if (!decoded.uid || !decoded.familyId || !decoded.jti) return null;
    return decoded;
  } catch {
    return null;
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
