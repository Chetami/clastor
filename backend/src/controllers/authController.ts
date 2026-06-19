import { Request, Response } from "express";
import { verifyFirebaseToken } from "../services/authService";
import { getUserFromFirestore, generateJWTForUser, updateLastActive } from "../services/userService";

/**
 * Login controller
 * Verifies Firebase token and returns custom JWT
 */
export async function login(req: Request, res: Response) {
  try {
    // Get Firebase token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    const firebaseToken = authHeader.substring(7);

    // Verify Firebase token
    const decodedFirebase = await verifyFirebaseToken(firebaseToken);

    // Get user from Firestore
    const user = await getUserFromFirestore(decodedFirebase.uid);

    // Generate custom JWT
    const jwtToken = generateJWTForUser(user);

    // Update last active timestamp
    await updateLastActive(user.id);

    return res.status(200).json({
      jwtToken,
      user: {
        uid: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    const message = error instanceof Error ? error.message : "Login failed";
    return res.status(401).json({ message });
  }
}

/**
 * Verify token controller
 * Verifies JWT and returns user info
 */
export async function verifyToken(req: Request, res: Response) {
  // If we reach here, the middleware has already verified the token
  // and attached user info to req.user
  return res.status(200).json({
    user: req.user,
  });
}
