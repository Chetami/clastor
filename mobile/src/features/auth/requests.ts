import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  exchangeFirebaseToken,
  revokeRefreshToken,
} from "@examify-tms/shared";
import type { LoginResponse } from "@examify-tms/interfaces";
import { firebaseAuth } from "@/lib/firebase";

const firebaseAuthErrorMap: Record<string, string> = {
  "auth/invalid-email": "Invalid email address",
  "auth/invalid-credential": "Invalid email or password",
  "auth/wrong-password": "Invalid email or password",
  "auth/user-not-found": "Invalid email or password",
  "auth/missing-password": "Password is required",
  "auth/network-request-failed":
    "Network error. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/internal-error": "Authentication failed. Please try again.",
};

function mapFirebaseError(error: unknown): Error {
  const code = (error as { code?: string }).code ?? "";
  return new Error(firebaseAuthErrorMap[code] ?? "Authentication failed");
}

/**
 * Sign in with email/password via Firebase, then exchange the resulting
 * Firebase ID token for the app's own JWT + refresh token pair (POST
 * /api/auth/login). Mirrors the web client's `loginRequest`.
 */
export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
    const firebaseToken = await credential.user.getIdToken();
    return exchangeFirebaseToken(firebaseToken);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw mapFirebaseError(error);
  }
}

/**
 * Best-effort sign-out: revoke the refresh token server-side, then clear the
 * Firebase session locally. Never throws.
 */
export async function logoutRequest(refreshToken?: string | null): Promise<void> {
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // ignore — local sign-out proceeds regardless
    }
  }
  try {
    await signOut(firebaseAuth);
  } catch {
    // ignore
  }
}
