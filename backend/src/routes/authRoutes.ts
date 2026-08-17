import { Router } from "express";
import { login, verifyToken, register, googleAuth, refresh, logout, joinWaitlist, resendVerification, forgotPassword } from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  loginLimiter,
  registerLimiter,
  firebaseGoogleLoginLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  waitlistLimiter,
} from "../middleware/rateLimit";
import { registerSchema, refreshTokenSchema, joinWaitlistSchema, forgotPasswordSchema } from "../schemas";

const router = Router();

// These endpoints are PUBLIC (Firebase token / refresh token / no credential
// at all), so each carries a strict IP-keyed rate limit ahead of validation —
// see middleware/rateLimit.ts for the per-endpoint rationale.

/**
 * POST /api/auth/login
 * Login endpoint - accepts Firebase token, returns custom JWT
 */
router.post("/login", loginLimiter, login);

/**
 * POST /api/auth/google
 * Google sign-in endpoint - accepts Firebase token obtained via Google sign-in.
 * Logs in an existing user or creates a new account from the Google profile.
 */
router.post("/google", firebaseGoogleLoginLimiter, googleAuth);

/**
 * POST /api/auth/register
 * Register endpoint - creates Firestore document for Firebase user, returns custom JWT
 * Note: Does NOT use authenticateJWT middleware because it receives a Firebase ID token
 */
router.post('/register', registerLimiter, validateRequest({ body: registerSchema }), register);

/**
 * GET /api/auth/verify
 * Verify JWT endpoint - returns user info if token is valid
 */
router.get("/verify", authenticateJWT, verifyToken);

/**
 * POST /api/auth/refresh
 * Exchange a (rotating) refresh token for a fresh access + refresh token pair.
 * Does not use authenticateJWT — the refresh token is the credential.
 */
router.post("/refresh", refreshLimiter, validateRequest({ body: refreshTokenSchema }), refresh);

/**
 * POST /api/auth/logout
 * Revoke the presented refresh token server-side. Always succeeds (200).
 * No dedicated limiter — it's a cheap, token-gated write covered by the
 * global /api ceiling.
 */
router.post("/logout", logout);

/**
 * POST /api/auth/forgot-password
 * Public. Sends a branded password-reset email when the address is known.
 * Always returns the same generic 200 (no account enumeration).
 */
router.post("/forgot-password", forgotPasswordLimiter, validateRequest({ body: forgotPasswordSchema }), forgotPassword);

/**
 * POST /api/auth/resend-verification
 * Re-send the Firebase email-verification link to the authenticated user via
 * SMTP. No-op success when already verified. The limiter runs AFTER
 * authenticateJWT so its bucket is keyed by uid, not IP.
 */
router.post("/resend-verification", authenticateJWT, resendVerificationLimiter, resendVerification);

/**
 * POST /api/auth/waitlist
 * Pre-signup waitlist join for organisations (org features not live yet).
 * Public — no auth required; stores email + survey in the waitlist collection.
 */
router.post("/waitlist", waitlistLimiter, validateRequest({ body: joinWaitlistSchema }), joinWaitlist);

export default router;
