import { getFirebaseFirestore } from "../config/firebase";
import { User, Role } from "@examify-tms/interfaces";
import { generateToken } from "../utils/jwt";
import admin from "firebase-admin";

/**
 * Get user document from Firestore
 * @param uid - User UID
 * @returns User object from Firestore
 */
export async function getUserFromFirestore(uid: string): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    const userDoc = await firestore.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      throw new Error("User not found in Firestore");
    }

    const userData = userDoc.data();

    return {
      id: uid,
      name: userData!.name,
      email: userData!.email,
      role: userData!.role,
      avatarUrl: userData!.avatarUrl,
      createdAt: userData!.createdAt.toDate(),
      updatedAt: userData!.updatedAt.toDate(),
      lastActive: userData!.lastActive?.toDate(),
    };
  } catch (error) {
    console.error("Failed to get user from Firestore:", error);
    throw new Error("User not found");
  }
}

/**
 * Update user's last active timestamp
 * @param uid - User UID
 */
export async function updateLastActive(uid: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      lastActive: new Date(),
    });
  } catch (error) {
    console.error("Failed to update last active:", error);
    // Don't throw - this is a non-critical update
  }
}

/**
 * Create user document in Firestore
 * @param id - User ID (Firebase Auth UID)
 * @param email - User email
 * @param name - User display name
 * @param role - User role (defaults to 'tutor')
 * @returns Created user object
 */
export async function createUserInFirestore(
  id: string,
  email: string,
  name: string,
  role: Role = 'tutor'
): Promise<User> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();

  const userData = {
    name,
    email,
    role,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastActive: now,
  };

  await firestore.collection('users').doc(id).set(userData);

  // Return User object with ISO string timestamps (matching User type)
  return {
    id,
    name,
    email,
    role,
    avatarUrl: null,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
    lastActive: now.toDate().toISOString(),
  };
}

/**
 * Generate JWT token for user
 * @param user - User object
 * @returns JWT token string
 */
export function generateJWTForUser(user: User): string {
  return generateToken(user.id, user.email, user.role);
}
