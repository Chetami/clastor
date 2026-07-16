import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  type Auth,
} from "firebase/auth";

/**
 * Firebase client configuration for the mobile app, loaded from environment
 * variables (Expo's `EXPO_PUBLIC_*` convention — see `.env`).
 *
 * These values are NOT secrets — they're the same public config embedded in
 * the web app's bundle. Create a `.env` file in `mobile/` using
 * `.env.example` as a template, then fill in your Firebase console values.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    // Firebase auth state is kept in-memory only: our app manages its own
    // session via JWTs (stored in SecureStore through the shared store), so
    // Firebase persistence across restarts isn't needed. Firebase is only
    // touched at the login moment to mint an ID token.
    firebaseAuth = initializeAuth(getFirebaseApp(), {
      persistence: inMemoryPersistence,
    });
  }
  return firebaseAuth;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey);
}
