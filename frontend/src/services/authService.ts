import axios from "axios";
import { getFirebaseAuth } from "../config/firebase";
import { signInWithEmailAndPassword, signOut as firebaseSignOut, createUserWithEmailAndPassword } from "firebase/auth";
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
 * Register a new user
 * Creates Firebase Auth user, then calls backend to create Firestore document
 * @param name - User's display name
 * @param email - User's email
 * @param password - User's password (min 6 characters)
 * @returns LoginResponse with JWT token and user info
 * @throws Error with user-friendly message on failure
 */
export async function register(
  name: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  let firebaseUserCredential: any | null = null;

  try {
    // 1. Create user in Firebase Auth
    const firebaseAuth = getFirebaseAuth();
    firebaseUserCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // 2. Get Firebase ID token
    const firebaseToken = await firebaseUserCredential.user.getIdToken();

    // 3. Call backend to create Firestore document and get custom JWT
    const response = await axios.post<LoginResponse>(
      `${API_URL}/api/auth/register`,
      { name },
      {
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    // Map Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email already registered');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    }

    // Handle backend errors - rollback Firebase user creation
    // Only rollback if error is NOT from Firebase Auth (meaning Firebase user was created but backend call failed)
    if (firebaseUserCredential && !error.code?.startsWith('auth/')) {
      try {
        await firebaseUserCredential.user.delete();
        console.log('Rolled back Firebase user due to backend error');
      } catch (deleteError) {
        console.error('Failed to rollback Firebase user:', deleteError);
      }
    }

    // Handle axios errors from backend
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data || { message: "Registration failed" };
      throw new Error(apiError.message);
    }

    throw error;
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
