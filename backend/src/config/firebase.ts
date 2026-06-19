import admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin";

/**
 * Firebase Admin SDK configuration
 * Initialized from environment variables
 */
let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  };

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  return firebaseApp;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp!.auth();
}

export function getFirebaseFirestore(): admin.firestore.Firestore {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp!.firestore();
}
