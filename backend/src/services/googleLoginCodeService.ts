import crypto from "crypto";
import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";

/**
 * One-time sign-in codes for the merged Google login flow.
 *
 * The OAuth callback must hand the just-authenticated identity to the browser
 * via a redirect, but tokens must NEVER travel in a URL (browser history,
 * Referer headers, server logs). Instead the callback mints a short-lived
 * opaque code; the frontend immediately POSTs it to /api/auth/google/exchange
 * which swaps it for a fresh JWT + refresh token pair over the back channel.
 *
 * Standards applied (OAuth 2.0 / OIDC authorization-code style guarantees):
 *  - 256 bits of randomness from crypto.randomBytes (unpredictable).
 *  - Only a SHA-256 hash of the code is stored — a Firestore leak can't be
 *    replayed as a login.
 *  - Single-use: the doc is deleted inside the transaction that reads it, so
 *    two concurrent redemptions can't both succeed.
 *  - Short TTL (2 minutes) — the exchange happens seconds after the redirect.
 *
 * Garbage collection: expired-but-never-redeemed docs are deleted by a
 * Firestore TTL policy on `ttlExpiresAt` (see the setup step in
 * deploy/templates/FIREBASE_SETUP.md). TTL deletion is lazy — Google allows
 * up to ~72h lag — so the policy runs on a timestamp comfortably beyond the
 * functional expiry, which is still checked exactly in code via
 * `expiresAtMs`.
 */

const COLLECTION = "googleLoginCodes";
const CODE_TTL_MS = 2 * 60 * 1000;
/** Slack for the TTL policy's lazy deletion — well past the functional TTL. */
const CODE_TTL_GRACE_MS = 60 * 60 * 1000;

/** Identity data bound to an issued code. */
export interface GoogleLoginCodeData {
  uid: string;
  /** True when this login created the user's Firestore document. */
  isNewUser: boolean;
}

/** SHA-256 hex hash of a code string (never store the raw code). */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Mint a single-use login code bound to the given user. Returns the raw code
 * (safe to place in a redirect URL — base64url has no reserved characters).
 */
export async function createGoogleLoginCode(
  data: GoogleLoginCodeData,
): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  const firestore = getFirebaseFirestore();
  await firestore
    .collection(COLLECTION)
    .doc(hashCode(code))
    .set({
      uid: data.uid,
      isNewUser: data.isNewUser === true,
      // Stored as epoch millis, NOT a Date: Firestore returns Dates as
      // Timestamp objects on read (no .getTime()), which would break the
      // comparison below. Numbers round-trip exactly.
      expiresAtMs: Date.now() + CODE_TTL_MS,
      // Firestore TTL policies require a timestamp-typed field; this is what
      // the `googleLoginCodes.ttlExpiresAt` policy (FIREBASE_SETUP.md step 8)
      // deletes never-redeemed docs by. Set beyond the functional expiry so
      // the code path above always decides first.
      ttlExpiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + CODE_TTL_MS + CODE_TTL_GRACE_MS,
      ),
      createdAt: new Date(),
    });
  return code;
}

/**
 * Redeem a login code exactly once. Returns the bound identity data, or null
 * when the code is unknown, already used, or expired. The Firestore doc is
 * deleted atomically with the read, so a replayed code always fails.
 */
export async function consumeGoogleLoginCode(
  code: string,
): Promise<GoogleLoginCodeData | null> {
  const firestore = getFirebaseFirestore();
  const ref = firestore.collection(COLLECTION).doc(hashCode(code));

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as
      | { uid?: string; isNewUser?: boolean; expiresAtMs?: number }
      | undefined;

    const expired =
      !data ||
      !data.uid ||
      typeof data.expiresAtMs !== "number" ||
      data.expiresAtMs < Date.now();

    if (!snap.exists || expired) {
      // Best-effort cleanup of an expired doc so the collection self-prunes.
      if (snap.exists) tx.delete(ref);
      return null;
    }

    tx.delete(ref);
    return { uid: data.uid!, isNewUser: data.isNewUser === true };
  });
}
