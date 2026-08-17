import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFirebaseAuth } from "@/config/firebase";
import {
  exchangeFirebaseToken,
  registerFirebaseToken,
  revokeRefreshToken,
  verifyRequest,
  refreshRequest,
  getApiBaseUrl,
} from "@examify-tms/shared";
import type {
  LoginResponse,
  RefreshTokenResponse,
  SignupSurvey,
} from "@examify-tms/interfaces";
import type { User as FirebaseUser } from "firebase/auth";

// Re-export the platform-agnostic auth requests so existing imports
// (`@/features/auth/api` barrel) keep resolving without touching call sites.
export { verifyRequest, refreshRequest };

const firebaseAuthErrorMap: Record<string, string> = {
  "auth/email-already-in-use": "Email already registered",
  "auth/weak-password": "Password must be at least 6 characters",
  "auth/invalid-email": "Invalid email address",
  "auth/invalid-credential": "Invalid email or password",
  "auth/network-request-failed": "Network error. Please check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/popup-closed-by-user": "Sign-in popup was closed before completing.",
  "auth/cancelled-popup-request": "Sign-in popup was cancelled.",
  "auth/popup-blocked": "Sign-in popup was blocked by the browser.",
  "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
};

function mapFirebaseError(error: unknown): Error {
  const code = (error as { code?: string }).code ?? "";
  return new Error(firebaseAuthErrorMap[code] ?? "Authentication failed");
}

/**
 * Detect the browser's IANA timezone at sign-up so the backend can render
 * lesson emails and calendar invites in the tutor's local time. Returns null
 * when the runtime can't resolve one, so we simply omit it rather than send a
 * bad value.
 */
function detectBrowserTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const firebaseAuth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );
    const firebaseToken = await userCredential.user.getIdToken();
    return exchangeFirebaseToken(firebaseToken);
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) {
      throw mapFirebaseError(error);
    }
    throw error;
  }
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
  signupSurvey?: SignupSurvey,
): Promise<LoginResponse> {
  let firebaseUserCredential: { user: FirebaseUser } | null = null;

  try {
    const firebaseAuth = getFirebaseAuth();
    firebaseUserCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );

    const firebaseToken = await firebaseUserCredential.user.getIdToken();
    // Route through /api/auth/register (not /api/auth/login) so the backend
    // CREATES the Firestore document for this brand-new Firebase user. The
    // login endpoint requires the doc to already exist and would 401. The
    // backend also sends the branded verification email as part of register.
    return registerFirebaseToken(firebaseToken, {
      name,
      timezone: detectBrowserTimezone(),
      signupSurvey: signupSurvey ?? null,
    });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";

    if (firebaseUserCredential && !code.startsWith("auth/")) {
      try {
        await firebaseUserCredential.user.delete();
      } catch {
        // best-effort rollback
      }
    }

    if (code.startsWith("auth/")) {
      throw mapFirebaseError(error);
    }

    throw error;
  }
}

export async function logoutRequest(refreshToken?: string | null): Promise<void> {
  // Best-effort server-side revocation; never block logout on it.
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // ignore — local sign-out proceeds regardless
    }
  }

  const firebaseAuth = getFirebaseAuth();
  await firebaseSignOut(firebaseAuth);
}

/**
 * Build the backend URL that begins the merged Google login flow (sign-in +
 * Calendar consent in ONE Google screen). Navigating here 302-redirects to
 * Google; the browser eventually lands on /auth/google/callback with a
 * one-time code that `exchangeGoogleLoginCode` swaps for the app's tokens.
 *
 * Carries the same sign-up context the old popup flow sent in the request
 * body: the browser timezone (so server-rendered emails use the tutor's local
 * time) and the optional qualifier survey answers.
 */
export function buildGoogleLoginUrl(options: {
  returnTo?: string;
  signupSurvey?: SignupSurvey | null;
} = {}): string {
  const params = new URLSearchParams();
  if (options.returnTo) params.set("returnTo", options.returnTo);
  const timezone = detectBrowserTimezone();
  if (timezone) params.set("timezone", timezone);
  if (options.signupSurvey) {
    params.set("survey", JSON.stringify(options.signupSurvey));
  }
  const qs = params.toString();
  return `${getApiBaseUrl()}/api/auth/google/start${qs ? `?${qs}` : ""}`;
}

export type { RefreshTokenResponse };
