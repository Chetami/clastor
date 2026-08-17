import { rateLimit } from "express-rate-limit";

/**
 * Rate limiters for the PUBLIC Google login endpoints (`/api/auth/google/start`
 * and `/api/auth/google/exchange`). These are the only unauthenticated
 * endpoints that trigger server-side work on every hit (signed-JWT minting,
 * outbound redirects to Google, Firestore transactions), so they get IP-keyed
 * caps. Limits are deliberately generous — a normal login is 1 hit per
 * endpoint per attempt, so 30 per 15 minutes only trips on scripted abuse.
 *
 * Keying relies on `app.set("trust proxy", 1)` (see server.ts) so the real
 * client IP is read from X-Forwarded-For behind Passenger/nginx.
 */

function frontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
}

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 30;

/**
 * GET /api/auth/google/start — reached by full-tab navigation, so a 429 JSON
 * body would render as raw JSON in the browser. Instead redirect to the
 * frontend callback page with error=rate_limited, which shows a friendly
 * message and a way back to login.
 */
export const googleLoginStartLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res.redirect(
      `${frontendUrl()}/auth/google/callback?error=rate_limited`,
    );
  },
});

/**
 * POST /api/auth/google/exchange — called via the API client, so respond with
 * the standard JSON ApiError shape (matches what the frontend shows for other
 * 429s).
 */
export const googleLoginExchangeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many sign-in attempts. Please wait a few minutes and try again.",
  },
});
