import admin from "firebase-admin";

/**
 * Firebase Admin SDK configuration
 * Initialized from service account JSON file path
 */
let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccountKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (!serviceAccountKeyPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_PATH environment variable is not set");
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountKeyPath)),
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
