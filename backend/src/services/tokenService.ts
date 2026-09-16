import crypto from "crypto";
import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";
import { generateRefreshToken, verifyRefreshToken, generateJti } from "../utils/jwt";
import { generateJWTForUser, getUserFromFirestore, toUserInfo, updateLastActive } from "./userService";
import { getEmailVerified } from "./authService";
import type { User, UserInfo } from "@examify-tms/interfaces";
import { NotFoundError, UnauthorizedError } from "../utils/AppError";

const TOKENS = "refreshTokens";
const FAMILIES = "refreshTokenFamilies";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export interface TokenPair { jwtToken: string; refreshToken: string }
export interface RefreshResult extends TokenPair { user: UserInfo }

function preparePair(user: User, familyId: string, authTime: number) {
  const jti = generateJti();
  const refreshToken = generateRefreshToken(user.id, familyId, jti, authTime);
  const pair = { jwtToken: generateJWTForUser(user, authTime), refreshToken };
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + REFRESH_TTL_MS);
  return {
    jti, pair, expiresAt,
    record: {
      uid: user.id, familyId, authTime, tokenHash: hashToken(refreshToken),
      revoked: false, expiresAt, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

/** Only call after a verified identity assertion; authTime must not be renewed by refresh. */
export async function issueNewTokenPair(user: User, authTime: number): Promise<TokenPair> {
  if (!Number.isInteger(authTime) || authTime <= 0) {
    throw new UnauthorizedError("Authentication time is missing", "AUTH_INVALID_SESSION");
  }
  await getEmailVerified(user.id, authTime);
  const firestore = getFirebaseFirestore();
  const familyId = generateJti();
  const next = preparePair(user, familyId, authTime);
  const batch = firestore.batch();
  batch.create(firestore.collection(FAMILIES).doc(familyId), {
    uid: user.id, authTime, revoked: false, expiresAt: next.expiresAt,
  });
  batch.create(firestore.collection(TOKENS).doc(next.jti), next.record);
  await batch.commit();
  return next.pair;
}

/** Atomic consume/replace; a shared family record serializes rotation and revocation. */
export async function rotateRefreshToken(presentedToken: string): Promise<RefreshResult> {
  const payload = verifyRefreshToken(presentedToken);
  if (!payload) throw new UnauthorizedError("Invalid refresh token", "AUTH_INVALID_SESSION");

  // Resolve fallible dependencies BEFORE consuming the credential. A Firebase
  // or database outage leaves the old refresh token usable on a later attempt.
  const emailVerified = await getEmailVerified(payload.uid, payload.auth_time);
  let user: User;
  try {
    user = await getUserFromFirestore(payload.uid);
  } catch (error) {
    if (error instanceof NotFoundError) throw new UnauthorizedError("Account no longer exists", "AUTH_INVALID_SESSION");
    throw error;
  }
  const userInfo = toUserInfo(user, emailVerified);
  const firestore = getFirebaseFirestore();
  const tokenRef = firestore.collection(TOKENS).doc(payload.jti);
  const familyRef = firestore.collection(FAMILIES).doc(payload.familyId);
  const next = preparePair(user, payload.familyId, payload.auth_time);
  const accepted = await firestore.runTransaction(async (tx) => {
    const [tokenDoc, familyDoc] = await Promise.all([tx.get(tokenRef), tx.get(familyRef)]);
    const token = tokenDoc.data();
    const family = familyDoc.data();
    if (!family || family.uid !== payload.uid || family.authTime !== payload.auth_time ||
        family.revoked || !family.expiresAt || family.expiresAt.toMillis() <= Date.now()) return false;

    if (!token || token.revoked || token.uid !== payload.uid ||
        token.familyId !== payload.familyId || token.authTime !== payload.auth_time ||
        token.tokenHash !== hashToken(presentedToken) ||
        !token.expiresAt || token.expiresAt.toMillis() <= Date.now()) {
      // Return (don't throw) so the revocation is committed even on replay.
      tx.update(familyRef, { revoked: true });
      return false;
    }
    tx.update(tokenRef, { revoked: true });
    tx.create(firestore.collection(TOKENS).doc(next.jti), next.record);
    tx.update(familyRef, { expiresAt: next.expiresAt });
    return true;
  });
  if (!accepted) throw new UnauthorizedError("Session expired or revoked. Please sign in again.", "AUTH_INVALID_SESSION");
  // Nothing fallible may invalidate a successful rotation after commit.
  void updateLastActive(user.id).catch(() => undefined);
  return { ...next.pair, user: userInfo };
}

/** Revoke the family, so logout also wins against an in-flight rotation. */
export async function revokeRefreshToken(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return;
  const payload = verifyRefreshToken(presentedToken);
  if (!payload) return;
  try {
    const firestore = getFirebaseFirestore();
    const familyRef = firestore.collection(FAMILIES).doc(payload.familyId);
    await firestore.runTransaction(async (tx) => {
      const family = (await tx.get(familyRef)).data();
      if (family?.uid === payload.uid && family.authTime === payload.auth_time) {
        tx.update(familyRef, { revoked: true });
      }
    });
  } catch {
    // Local logout always proceeds. Access tokens have a bounded 15-minute TTL.
    console.warn("Could not revoke session; server storage is unavailable");
  }
}
