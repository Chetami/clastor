import Stripe from "stripe";
import { ServiceUnavailableError } from "../utils/AppError";

/**
 * Stripe configuration
 *
 * The Stripe SDK is initialised lazily from STRIPE_SECRET_KEY, mirroring the
 * lazy-initialisation pattern used by email.ts and firebase.ts. The backend
 * can boot before Stripe is configured; code paths that genuinely need Stripe
 * check isStripeConfigured() and surface a clear error otherwise.
 */

let stripeClient: Stripe | null = null;

/**
 * Whether Stripe is configured (secret key present). Used so callers can give
 * a friendly "not configured" error rather than throwing on initialisation.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily build and cache the Stripe client. Throws if not configured so the
 * caller surfaces the problem rather than silently no-op'ing.
 */
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceUnavailableError(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to accept online payments."
    );
  }

  stripeClient = new Stripe(secretKey, {
    appInfo: { name: "Clastor" },
  });

  return stripeClient;
}

/**
 * The webhook signing secret used to verify that incoming webhook events are
 * genuinely from Stripe. Empty string when unset (webhook handling then throws).
 */
export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

/**
 * The public base URL of the frontend app, used to build Stripe redirect
 * targets (onboarding return, checkout success/cancel). Defaults to the local
 * dev origin. Trailing slash is stripped.
 */
export function getAppUrl(): string {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}
