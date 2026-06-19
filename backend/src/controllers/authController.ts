import { Request, Response } from "express";
import { verifyFirebaseToken } from "../services/authService";
import { getUserFromFirestore, generateJWTForUser, updateLastActive } from "../services/userService";
import { LoginResponse, UserInfo, ApiError } from "@examify-tms/interfaces";

/**
 * Login controller
 * Verifies Firebase token and returns custom JWT
 */
export async function login(req: Request, res: Response<LoginResponse | ApiError>) {
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

    const userInfo: UserInfo = {
      uid: user.id,
      email: user.email,
      role: user.role,
    };

    return res.status(200).json({
      jwtToken,
      user: userInfo,
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
export async function verifyToken(req: Request, res: Response<{ user: UserInfo } | ApiError>) {
  // If we reach here, the middleware has already verified the token
  // and attached user info to req.user
  if (!req.user) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const userInfo: UserInfo = {
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role,
  };

  return res.status(200).json({
    user: userInfo,
  });
}
