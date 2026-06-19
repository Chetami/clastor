import { getFirebaseAuth } from "../config/firebase";

/**
 * Verify Firebase ID token
 * @param token - Firebase ID token from client
 * @returns Decoded token with user info
 */
export async function verifyFirebaseToken(token: string) {
  try {
    const firebaseAuth = getFirebaseAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    throw new Error("Invalid Firebase token");
  }
}

/**
 * Get user by UID from Firebase Auth
 * @param uid - User UID
 * @returns User record from Firebase Auth
 */
export async function getUserByUid(uid: string) {
  try {
    const firebaseAuth = getFirebaseAuth();
    const userRecord = await firebaseAuth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error("Failed to get user by UID:", error);
    throw new Error("User not found in Firebase Auth");
  }
}
