import { Router } from "express";
import {
  getGoogleAuthUrl,
  googleAuthCallback,
  getGoogleConnectionStatus,
  disconnectGoogle,
  startGoogleLogin,
  exchangeGoogleLoginCode,
} from "../controllers/googleAuthController";
import { authenticateJWT } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { googleLoginStartQuerySchema, googleLoginExchangeSchema } from "../schemas";

const router = Router();

/**
 * GET /api/auth/google/start
 * PUBLIC. Begins the merged Google login flow (sign-in + Calendar consent in
 * one screen): 302-redirects the browser to Google with a signed login-mode
 * state. The button on the login/signup pages navigates here directly.
 */
router.get(
  "/start",
  validateRequest({ query: googleLoginStartQuerySchema }),
  startGoogleLogin,
);

/**
 * GET /api/auth/google/callback
 * OAuth redirect target (no auth header — identity comes from signed state).
 * Handles both the public login flow and the authenticated connect flow.
 */
router.get("/callback", googleAuthCallback);

/**
 * POST /api/auth/google/exchange
 * PUBLIC. Back-channel half of the merged login flow: swaps the single-use
 * code from the redirect for a JWT + refresh token pair.
 */
router.post(
  "/exchange",
  validateRequest({ body: googleLoginExchangeSchema }),
  exchangeGoogleLoginCode,
);

/**
 * GET /api/auth/google/url
 * Get a Google OAuth consent URL for the authenticated tutor.
 */
router.get("/url", authenticateJWT, getGoogleAuthUrl);

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
