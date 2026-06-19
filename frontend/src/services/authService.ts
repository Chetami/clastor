import axios from "axios";
import { getFirebaseAuth } from "../config/firebase";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { LoginResponse, ApiError, UserInfo } from "@examify-tms/interfaces";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Login with email and password
 * First authenticates with Firebase, then exchanges for custom JWT
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    // First, authenticate with Firebase
    const firebaseAuth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const firebaseUser = userCredential.user;

    // Get Firebase ID token
    const firebaseToken = await firebaseUser.getIdToken();

    // Exchange for custom JWT
    const response = await axios.post<LoginResponse>(
      `${API_URL}/api/auth/login`,
      {},
      {
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data || { message: "Login failed" };
      throw new Error(apiError.message);
    }
    throw new Error("Firebase authentication failed");
  }
}

/**
 * Logout user
 */
export async function signOut(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  await firebaseSignOut(firebaseAuth);
}

/**
 * Verify custom JWT with backend
 */
export async function verifyToken(token: string): Promise<UserInfo> {
  try {
    const response = await axios.get<LoginResponse>(`${API_URL}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.user;
  } catch (error) {
    throw new Error("Token verification failed");
  }
}
