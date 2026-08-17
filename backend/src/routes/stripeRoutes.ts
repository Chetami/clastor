import { Router } from "express";
import {
  getAccountStatus,
  connect,
  dashboardLink,
  payRedirect,
  webhook,
} from "../controllers/stripeController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { stripePayLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * POST /api/stripe/webhook
 * Public Stripe webhook receiver. Registered with express.raw() in server.ts
 * (BEFORE the global JSON parser) so the raw body is available for signature
 * verification. No auth — Stripe is the caller.
 */
router.post("/webhook", webhook);

/**
 * GET /api/stripe/pay/:invoiceId
 * PUBLIC. Mints a fresh Checkout Session and 302-redirects to Stripe's hosted
 * checkout. This is the stable link embedded in invoice emails; the recipient
 * is not a user, so no auth. Rate-limited: each hit mints a Stripe Checkout
 * Session, so predictable invoice ids must not be scrapeable.
 */
router.get("/pay/:invoiceId", stripePayLimiter, payRedirect);

/**
 * GET /api/stripe/account
 * Connect status for the authenticated tutor.
 */
router.get("/account", authenticateJWT, getAccountStatus);

/**
 * POST /api/stripe/connect
 * Create/reuse the Express account and return a single-use onboarding URL.
 */
router.post(
  "/connect",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  connect
);

/**
 * POST /api/stripe/dashboard-link
 * Single-use Stripe Express dashboard login URL (manage payouts/balance).
 */
router.post(
  "/dashboard-link",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  dashboardLink
);

export default router;
