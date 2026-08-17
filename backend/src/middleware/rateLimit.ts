import { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

/**
 * Tiered rate limiting for the API.
 *
 * PUBLIC endpoints carry the strict caps — they are the abuse surface
 * (credential stuffing, email bombing, account-creation spam, SMTP cost).
 * Authenticated traffic only gets a generous global ceiling so a stolen JWT
 * can't hammer the backend; normal clients never come near it.
 *
 * Keying relies on `app.set("trust proxy", 1)` (see server.ts) so the real
 * client IP is read from X-Forwarded-For behind Passenger/nginx. All limiters
 * use the in-memory store — fine for the single-instance Passenger deploy.
 */

function frontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
}

const FIFTEEN_MIN = 15 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

/** Human-friendly 429 body in the standard ApiError shape. */
function tooManyAttempts(message: string) {
  return { message };
}

/** JSON-responding limiter — used by every API (fetch/XHR) endpoint. */
function jsonLimiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  /** Override the key when a better one than IP is available post-auth. */
  keyGenerator?: (req: import("express").Request) => string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
    message: tooManyAttempts(options.message),
  }) as unknown as RequestHandler;
}

/**
 * Redirect-responding limiter — used by endpoints reached via full-tab
 * navigation (the Google OAuth redirects), where a raw JSON 429 would render
 * as gibberish in the browser.
 */
function redirectLimiter(options: {
  windowMs: number;
  limit: number;
  redirectTo: string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.redirect(options.redirectTo);
    },
  }) as unknown as RequestHandler;
}

// ---------------------------------------------------------------------------
// Tier 1 — public auth surface (strictest)
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login — the credential-stuffing target. A real user submits
 * a handful of attempts at most; 20/15min leaves headroom for shared-IP
 * offices logging in during the same morning window.
 */
export const loginLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 20,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});

/**
 * POST /api/auth/register — each hit creates a Firebase user + Firestore doc
 * and triggers an SMTP send, so keep it tight.
 */
export const registerLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 10,
  message: "Too many accounts created from this network. Please try again later.",
});

/** POST /api/auth/google — Firebase-ID-token login exchange (mobile/web legacy). */
export const firebaseGoogleLoginLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});

/**
 * POST /api/auth/forgot-password — email-bombing target: every accepted hit
 * costs an SMTP send. 5/15min is plenty for a genuinely forgetful human.
 */
export const forgotPasswordLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  message: "Too many password-reset requests. Please wait a few minutes and try again.",
});

/**
 * POST /api/auth/resend-verification — authenticated, so keyed by uid
 * (mounted AFTER authenticateJWT): one user spamming SMTP can't exhaust the
 * bucket for anyone else.
 */
export const resendVerificationLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  message: "Too many verification-email requests. Please wait a few minutes and try again.",
  keyGenerator: (req) => {
    const uid = (req.user as { uid?: string } | undefined)?.uid;
    return typeof uid === "string" && uid ? uid : (req.ip ?? "unknown-client");
  },
});

/** POST /api/auth/waitlist — public write into Firestore. */
export const waitlistLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  message: "Too many requests. Please try again later.",
});

/**
 * POST /api/auth/refresh — the refresh token is the credential, so abuse is
 * already self-limiting, but a generous per-IP cap stops brute-force token
 * guessing. Multiple tabs share one in-flight refresh client-side, so even
 * NAT'd offices stay far below 60/15min.
 */
export const refreshLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 60,
  message: "Too many requests. Please sign in again.",
});

// ---------------------------------------------------------------------------
// Tier 1 — public Google merged-login flow
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/google/start — reached by full-tab navigation, so a 429 JSON
 * body would render as raw JSON in the browser. Instead redirect to the
 * frontend callback page with error=rate_limited, which shows a friendly
 * message and a way back to login.
 */
export const googleLoginStartLimiter = redirectLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  redirectTo: `${frontendUrl()}/auth/google/callback?error=rate_limited`,
});

/**
 * GET /api/auth/google/callback — Google's redirect target; same navigation
 * constraints as /start.
 */
export const googleCallbackLimiter = redirectLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  redirectTo: `${frontendUrl()}/auth/google/callback?error=rate_limited`,
});

/**
 * POST /api/auth/google/exchange — called via the API client, so respond with
 * the standard JSON ApiError shape (matches what the frontend shows for other
 * 429s).
 */
export const googleLoginExchangeLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});

// ---------------------------------------------------------------------------
// Tier 2 — public reads/link endpoints (moderate)
// ---------------------------------------------------------------------------

/**
 * GET /api/lessons/rsvp — unauthenticated but carries a signed RSVP token in
 * the query (students click these from email). The signature check is the
 * real guard; this cap just stops URL-guessing scrapers.
 */
export const rsvpLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 60,
  message: "Too many requests. Please try again later.",
});

/**
 * GET /api/stripe/pay/:invoiceId — embedded in invoice emails, so recipients
 * are unauthenticated. Each hit mints a Checkout Session (a Stripe API call),
 * so cap scraping of predictable invoice ids.
 */
export const stripePayLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  message: "Too many requests. Please try again later.",
});

/**
 * GET /api/tutor-profiles/public/:slug — the only public profile read.
 * Slugs are guessable, hence a cap well above any human browse rate.
 */
export const publicProfileLimiter = jsonLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 60,
  message: "Too many requests. Please try again later.",
});

// ---------------------------------------------------------------------------
// Tier 3 — global ceiling over everything under /api
// ---------------------------------------------------------------------------

/**
 * Applied app-wide to /api in server.ts as a backstop behind the strict
 * route-level limiters. Generous by design: authenticated traffic is
 * legitimate (and may share a NAT egress IP), so this only exists to stop a
 * runaway script or stolen token from hammering the backend. The Stripe
 * webhook is skipped — it is signature-verified by Stripe and burst-retried
 * legitimately, so dropping events to rate limiting would be worse than the
 * abuse it prevents.
 */
export const globalApiLimiter = rateLimit({
  windowMs: FIVE_MIN,
  limit: 2000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/stripe/webhook",
  message: tooManyAttempts("Too many requests. Please slow down and try again shortly."),
});
