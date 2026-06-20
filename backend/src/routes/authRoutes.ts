import { Router } from "express";
import { login, verifyToken, register, googleAuth } from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/login
 * Login endpoint - accepts Firebase token, returns custom JWT
 */
router.post("/login", login);

/**
 * POST /api/auth/google
 * Google sign-in endpoint - accepts Firebase token obtained via Google sign-in.
 * Logs in an existing user or creates a new account from the Google profile.
 */
router.post("/google", googleAuth);

/**
 * POST /api/auth/register
 * Register endpoint - creates Firestore document for Firebase user, returns custom JWT
 * Note: Does NOT use authenticateJWT middleware because it receives a Firebase ID token
 */
router.post('/register', register);

/**
 * GET /api/auth/verify
 * Verify JWT endpoint - returns user info if token is valid
 */
router.get("/verify", authenticateJWT, verifyToken);

export default router;
