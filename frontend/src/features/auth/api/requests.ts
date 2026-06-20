import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { api } from "@/lib/api";
import { getFirebaseAuth } from "@/config/firebase";
import type { LoginResponse, UserInfo } from "@examify-tms/interfaces";

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

    const response = await api.post<LoginResponse>(
      "/api/auth/login",
      {},
      {
        headers: { Authorization: `Bearer ${firebaseToken}` },
      },
    );

    return response.data;
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw mapFirebaseError(error);
  }
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  let firebaseUserCredential: { user: { getIdToken: () => Promise<string>; delete: () => Promise<void> } } | null = null;

  try {
    const firebaseAuth = getFirebaseAuth();
    firebaseUserCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );

    const firebaseToken = await firebaseUserCredential.user.getIdToken();

    const response = await api.post<LoginResponse>(
      "/api/auth/register",
      { name },
      {
        headers: { Authorization: `Bearer ${firebaseToken}` },
      },
    );

    return response.data;
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

export async function verifyRequest(): Promise<UserInfo> {
  const response = await api.get<LoginResponse>("/api/auth/verify");
  return response.data.user;
}

export async function logoutRequest(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  await firebaseSignOut(firebaseAuth);
}

export async function googleSignInRequest(): Promise<LoginResponse> {
  try {
    const firebaseAuth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(firebaseAuth, provider);
    const firebaseToken = await userCredential.user.getIdToken();

    const response = await api.post<LoginResponse>(
      "/api/auth/google",
      {},
      {
        headers: { Authorization: `Bearer ${firebaseToken}` },
      },
    );

    return response.data;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) {
      throw mapFirebaseError(error);
    }
    throw error;
  }
}
