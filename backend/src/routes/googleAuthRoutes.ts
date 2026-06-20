import { Router } from "express";
import {
  getGoogleAuthUrl,
  googleAuthCallback,
  getGoogleConnectionStatus,
  disconnectGoogle,
} from "../controllers/googleAuthController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

/**
 * GET /api/auth/google/url
 * Get a Google OAuth consent URL for the authenticated tutor.
 */
router.get("/url", authenticateJWT, getGoogleAuthUrl);

/**
 * GET /api/auth/google/callback
 * OAuth redirect target (no auth header — identity comes from signed state).
 */
router.get("/callback", googleAuthCallback);

/**
 * GET /api/auth/google/status
 * Whether the tutor has connected a Google account.
 */
router.get("/status", authenticateJWT, getGoogleConnectionStatus);

/**
 * DELETE /api/auth/google
 * Disconnect the tutor's Google account.
 */
router.delete("/", authenticateJWT, disconnectGoogle);

export default router;
