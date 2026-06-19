/**
 * User role definitions
 */
export type Role = "system_admin" | "tutor";

/**
 * User interface
 * Represents a user in the Firestore users collection
 */
export interface User {
  id: string;              // Firebase Auth UID
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
}
