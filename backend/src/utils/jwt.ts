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
const ISSUER = "clastor";
type Purpose = "access" | "refresh" | "oauth-connect" | "oauth-login" | "rsvp";

// Domain-separated keys avoid cross-protocol acceptance without new deployment
// secrets. The purpose is also checked independently in the signed payload.
function keyFor(purpose: Purpose): Buffer {
  const secret = purpose === "refresh" ? REFRESH_TOKEN_SECRET : JWT_SECRET;
  return crypto.createHmac("sha256", secret).update(`clastor:${purpose}:v1`).digest();
}

function signFor(purpose: Purpose, payload: object, expiresIn: jwt.SignOptions["expiresIn"]): string {
  return jwt.sign({ ...payload, purpose }, keyFor(purpose), {
    algorithm: "HS256", issuer: ISSUER, audience: `clastor:${purpose}`, expiresIn,
  });
}

function verifyFor(token: string, purpose: Purpose): jwt.JwtPayload {
  const decoded = jwt.verify(token, keyFor(purpose), {
    algorithms: ["HS256"], issuer: ISSUER, audience: `clastor:${purpose}`,
  });
  if (typeof decoded === "string" || decoded.purpose !== purpose ||
      !Number.isInteger(decoded.iat) || !Number.isInteger(decoded.exp) ||
      decoded.iat! > Math.floor(Date.now() / 1000) || decoded.exp! <= decoded.iat!) {
    throw new Error("Invalid token claims");
  }
  return decoded;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validAuthTime(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 &&
    value <= Math.floor(Date.now() / 1000);
}

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
  /** Original authentication time; never advanced by refresh. */
  auth_time: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(
  uid: string, email: string, role: Role,
  authTime = Math.floor(Date.now() / 1000),
): string {
  return signFor("access", { uid, email, role, auth_time: authTime }, JWT_EXPIRY);
}

/** Verify signature, protocol and required claims; legacy access tokens fail. */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = verifyFor(token, "access");
    if (!nonEmpty(decoded.uid) || !nonEmpty(decoded.email) ||
        !["tutor", "system_admin"].includes(decoded.role) ||
        !validAuthTime(decoded.auth_time) || decoded.auth_time > decoded.iat! ||
        decoded.exp! - decoded.iat! > 15 * 60) throw new Error("Invalid claims");
    return decoded as JwtPayload;
  } catch {
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
  authTime = Math.floor(Date.now() / 1000),
): string {
  return signFor("refresh", { uid, familyId, jti, auth_time: authTime }, REFRESH_TOKEN_EXPIRY);
}

/**
 * Verify a refresh token's signature and expiry. Returns the decoded payload,
 * or null if invalid/expired. Callers must additionally check the Firestore
 * record (revoked / hash match) before trusting it.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = verifyFor(token, "refresh");
    if (!nonEmpty(decoded.uid) || !nonEmpty(decoded.familyId) || !nonEmpty(decoded.jti) ||
        !validAuthTime(decoded.auth_time) || decoded.auth_time > decoded.iat! ||
        decoded.exp! - decoded.iat! > 30 * 24 * 60 * 60) return null;
    return decoded as unknown as RefreshTokenPayload;
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
  return signFor("oauth-connect", payload, "10m");
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
    const decoded = verifyFor(token, "oauth-connect") as {
      uid?: string;
      r?: string;
    };
    if (!nonEmpty(decoded.uid)) return null;
    return {
      uid: decoded.uid,
      returnTo: typeof decoded.r === "string" ? decoded.r : null,
    };
  } catch {
    return null;
  }
}

/**
 * Sign a short-lived, opaque state token for the PUBLIC Google login flow
 * (merged sign-in + Calendar consent). Unlike {@link signStateToken} there is
 * no uid yet — the user isn't authenticated — so the state instead carries the
 * sign-up context (returnTo path, detected timezone, optional survey) that
 * must survive the round-trip through Google. The `m: "login"` marker keeps
 * login states from ever being accepted by the connect-flow verifier (and
 * vice versa: {@link verifyStateToken} requires a uid these tokens lack).
 *
 * `retry` is set only on the one-time consent-retry pass: when Google skips
 * the consent screen (prior grant) and returns no refresh token, the verified
 * identity (uid + whether this is a brand-new signup) rides in the signed
 * state so a declined retry can still complete the sign-in.
 */
export function signLoginStateToken(data: {
  returnTo: string | null;
  timezone: string | null;
  survey: unknown;
  retry?: { uid: string; isNewUser: boolean; authTime: number } | null;
}): string {
  return signFor(
    "oauth-login",
    {
      m: "login",
      r: data.returnTo ?? undefined,
      tz: data.timezone ?? undefined,
      sv: data.survey ?? undefined,
      rt: data.retry ?? undefined,
    },
    "10m",
  );
}

/** Payload returned by {@link verifyLoginStateToken}. */
export interface LoginStatePayload {
  returnTo: string | null;
  timezone: string | null;
  survey: unknown;
  /** Present only on the consent-retry pass; null otherwise. */
  retry: { uid: string; isNewUser: boolean; authTime: number } | null;
}

/**
 * Verify a login-mode state token, or null when invalid/expired/not a
 * login-mode token. The survey is returned raw — callers normalize it via
 * `normalizeSignupSurvey` before use. `returnTo` is null when the caller
 * supplied no explicit landing path; the post-login destination is then the
 * frontend's onboarding-aware decision, not ours.
 */
export function verifyLoginStateToken(
  token: string | undefined,
): LoginStatePayload | null {
  if (!token) return null;
  try {
    const decoded = verifyFor(token, "oauth-login") as {
      m?: string;
      r?: string;
      tz?: string;
      sv?: unknown;
      rt?: { uid?: unknown; isNewUser?: unknown; authTime?: unknown };
    };
    if (decoded.m !== "login") return null;
    return {
      returnTo: typeof decoded.r === "string" ? decoded.r : null,
      timezone: typeof decoded.tz === "string" ? decoded.tz : null,
      survey: decoded.sv ?? null,
      retry:
        decoded.rt &&
        typeof decoded.rt.uid === "string" &&
        typeof decoded.rt.isNewUser === "boolean" && validAuthTime(decoded.rt.authTime)
          ? { uid: decoded.rt.uid, isNewUser: decoded.rt.isNewUser, authTime: decoded.rt.authTime }
          : null,
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
  return signFor("rsvp", { lid: lessonId, v: version }, "30d");
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
  token: string | undefined,
): RsvpTokenPayload | null {
  if (!token) return null;
  try {
    let decoded: jwt.JwtPayload;
    try {
      decoded = verifyFor(token, "rsvp");
    } catch {
      // Keep already-emailed legacy invites usable for their original lifetime.
      // The exact legacy shape cannot be an access or OAuth-state credential.
      const legacy = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
      if (typeof legacy === "string" ||
          Object.keys(legacy).some((key) => !["lid", "v", "iat", "exp"].includes(key)) ||
          !Number.isInteger(legacy.iat) || !Number.isInteger(legacy.exp) ||
          legacy.iat! > Math.floor(Date.now() / 1000) ||
          legacy.exp! <= legacy.iat! || legacy.exp! - legacy.iat! > 30 * 24 * 60 * 60) return null;
      decoded = legacy;
    }
    if (!nonEmpty(decoded.lid) || !Number.isInteger(decoded.v) || decoded.v < 0) return null;
    return { lessonId: decoded.lid, version: decoded.v };
  } catch {
    return null;
  }
}
