import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { exchangeFirebaseToken, revokeRefreshToken } from "@examify-tms/shared";
import type { LoginResponse } from "@examify-tms/interfaces";
import { getFirebaseAuth } from "@/config/firebase";

// Configure once. Only the iOS Client ID is needed for native Google Sign-In.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
if (iosClientId) {
  GoogleSignin.configure({ iosClientId });
}

function mapFirebaseError(error: unknown): Error {
  const code = (error as { code?: string }).code ?? "";
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Email already registered",
    "auth/weak-password": "Password must be at least 6 characters",
    "auth/invalid-email": "Invalid email address",
    "auth/invalid-credential": "Invalid email or password",
    "auth/network-request-failed":
      "Network error. Please check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
  };
  return new Error(map[code] ?? "Authentication failed");
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const firebaseToken = await cred.user.getIdToken();
    return exchangeFirebaseToken(firebaseToken);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw mapFirebaseError(error);
  }
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  let cred: { user: { getIdToken: () => Promise<string>; delete: () => Promise<void> } } | null = null;
  try {
    const auth = getFirebaseAuth();
    cred = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseToken = await cred.user.getIdToken();
    return exchangeFirebaseToken(firebaseToken, { name });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (cred && !code.startsWith("auth/")) {
      try {
        await cred.user.delete();
      } catch {
        /* best-effort rollback */
      }
    }
    if (code.startsWith("auth/")) throw mapFirebaseError(error);
    throw error;
  }
}

/**
 * Native Google Sign-In. Opens the OS account-picker sheet, gets an ID token,
 * exchanges it for a Firebase credential, then for the backend JWT.
 */
export async function googleSignInRequest(): Promise<LoginResponse> {
  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;
  if (!idToken) throw new Error("Google Sign-In failed: no ID token");

  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(getFirebaseAuth(), credential);
  const firebaseToken = await userCred.user.getIdToken();
  return exchangeFirebaseToken(firebaseToken, { timezone: detectTimezone() });
}

function mapGoogleError(error: unknown): Error {
  const code = (error as { code?: string }).code ?? "";
  if (code === statusCodes.SIGN_IN_CANCELLED) return new Error("Sign-in cancelled");
  if (code === statusCodes.IN_PROGRESS) return new Error("Sign-in already in progress");
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
    return new Error("Google Play Services not available");
  return new Error("Google Sign-In failed");
}

export async function logoutRequest(refreshToken?: string | null): Promise<void> {
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      /* ignore — local sign-out proceeds regardless */
    }
  }
  await firebaseSignOut(getFirebaseAuth());
}

function detectTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}
