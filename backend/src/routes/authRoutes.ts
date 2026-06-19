import { Router } from "express";
import { login, verifyToken } from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/login
 * Login endpoint - accepts Firebase token, returns custom JWT
 */
router.post("/login", login);

/**
 * GET /api/auth/verify
 * Verify JWT endpoint - returns user info if token is valid
 */
router.get("/verify", authenticateJWT, verifyToken);

export default router;
