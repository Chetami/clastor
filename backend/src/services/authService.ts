import { getFirebaseAuth } from "../config/firebase";
import type { DecodedIdToken } from "firebase-admin/auth";
import { UnauthorizedError } from "../utils/AppError";

/**
 * Verify Firebase ID token
 * @param token - Firebase ID token from client
 * @returns Decoded token with user info
 */
export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  try {
    const firebaseAuth = getFirebaseAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    throw new UnauthorizedError("Invalid Firebase token");
  }
}
