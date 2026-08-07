import crypto from "crypto";
import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";
import {
  generateRefreshToken,
  verifyRefreshToken,
  generateJti,
} from "../utils/jwt";
import {
  generateJWTForUser,
  getUserFromFirestore,
  toUserInfo,
  updateLastActive,
} from "./userService";
import type { User, UserInfo } from "@examify-tms/interfaces";
import { UnauthorizedError } from "../utils/AppError";

/**
 * Rotating refresh-token management.
 *
 * Tokens are stored (hashed) in the `refreshTokens` Firestore collection keyed
 * by the token's `jti`. Each login starts a new `familyId`; every refresh
 * rotates the token (revokes the old doc, issues a new one in the same family).
 * If a revoked token is ever presented again, the entire family is revoked —
 * this "reuse detection" invalidates a stolen chain and forces re-login.
 */

const COLLECTION = "refreshTokens";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, mirrors jwt.ts

/** SHA-256 hex hash of a token string (never store raw refresh tokens). */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Result of issuing a fresh access + refresh token pair. */
export interface TokenPair {
  jwtToken: string;
  refreshToken: string;
}

/** Mark every refresh-token document in a family as revoked. */
async function revokeFamily(familyId: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection(COLLECTION)
    .where("familyId", "==", familyId)
    .get();

  if (snapshot.empty) return;

  const batch = firestore.batch();
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { revoked: true });
  }
  await batch.commit();
}

/**
 * Persist a new refresh-token record and return the signed pair. Reuses the
 * provided `familyId` when rotating, or starts a new family at login.
 */
async function issueTokenPair(
  user: User,
  familyId: string,
): Promise<TokenPair> {
  const jti = generateJti();
  const refreshToken = generateRefreshToken(user.id, familyId, jti);

  const firestore = getFirebaseFirestore();
  await firestore
    .collection(COLLECTION)
    .doc(jti)
    .set({
      uid: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      revoked: false,
      expiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + REFRESH_TTL_MS,
      ),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { jwtToken: generateJWTForUser(user), refreshToken };
}

/** Issue a brand-new token pair (new family) — used at login/register/google. */
export async function issueNewTokenPair(user: User): Promise<TokenPair> {
  return issueTokenPair(user, generateJti());
}

export interface RefreshResult {
  jwtToken: string;
  refreshToken: string;
  user: UserInfo;
}

/**
 * Rotate a presented refresh token into a fresh pair. Throws on any invalid,
 * expired, revoked, or replayed token. On reuse of a revoked token, the whole
 * family is revoked (signs the user out everywhere).
 */
export async function rotateRefreshToken(
  presentedToken: string,
): Promise<RefreshResult> {
  const payload = verifyRefreshToken(presentedToken);
  if (!payload) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const firestore = getFirebaseFirestore();
  const doc = await firestore
    .collection(COLLECTION)
    .doc(payload.jti)
    .get();

  const data = doc.data();
  const isReuse =
    !doc.exists ||
    !data ||
    data.revoked === true ||
    data.tokenHash !== hashToken(presentedToken);

  if (isReuse) {
    // A validly-signed but revoked/mismatched token means the chain was already
    // rotated — someone (possibly an attacker) is replaying an old token.
    // Burn the whole family to be safe.
    await revokeFamily(payload.familyId);
    throw new UnauthorizedError("Refresh token reuse detected");
  }

  // Valid, live token: revoke it and mint the next one in the same family.
  await doc.ref.update({ revoked: true });

  const user = await getUserFromFirestore(payload.uid);
  await updateLastActive(user.id);

  const pair = await issueTokenPair(user, payload.familyId);
  return { ...pair, user: toUserInfo(user) };
}

/**
 * Best-effort revoke of a presented refresh token at logout. Never throws —
 * logout must always succeed client-side even if the token is already gone.
 */
export async function revokeRefreshToken(
  presentedToken: string | undefined,
): Promise<void> {
  if (!presentedToken) return;

  const payload = verifyRefreshToken(presentedToken);
  if (!payload) return;

  try {
    const firestore = getFirebaseFirestore();
    await firestore
      .collection(COLLECTION)
      .doc(payload.jti)
      .update({ revoked: true });
  } catch {
    // Already revoked, expired, or missing — nothing to do.
  }
}
