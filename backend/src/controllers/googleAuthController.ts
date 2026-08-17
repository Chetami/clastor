import { Request, Response } from "express";
import { ApiError, LoginResponse } from "@examify-tms/interfaces";
import {
  getOAuth2Client,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_LOGIN_OAUTH_SCOPES,
} from "../config/googleOAuth";
import { getFirebaseAuth } from "../config/firebase";
import {
  signStateToken,
  verifyStateToken,
  signLoginStateToken,
  verifyLoginStateToken,
} from "../utils/jwt";
import {
  setGoogleConnection,
  getGoogleConnection,
  clearGoogleConnection,
  createUserInFirestore,
  getUserFromFirestore,
  normalizeSignupSurvey,
  normalizeTimezone,
  toUserInfo,
  updateLastActive,
} from "../services/userService";
import { issueNewTokenPair } from "../services/tokenService";
import {
  createGoogleLoginCode,
  consumeGoogleLoginCode,
} from "../services/googleLoginCodeService";
import { backfillUpcomingLessons } from "../services/googleCalendarService";

function frontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
}

/**
 * Coerce a caller-supplied return path into something safe to redirect to.
 * Only same-origin absolute paths are allowed (must start with a single "/",
 * never "//"), otherwise we fall back to /settings.
 */
function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/settings";
  }
  return raw;
}

/**
 * GET /api/auth/google/start
 * PUBLIC entry point for the merged Google LOGIN flow (sign-in + Calendar
 * consent in one screen). Redirects (302) the browser straight to Google's
 * authorization endpoint with a signed login-mode `state` — no JSON round
 * trip, so the button can be a plain navigation.
 *
 * Query params (all optional):
 *  - returnTo:  same-origin path to land on after login (defaults handled
 *               client-side; backend falls back to /dashboard)
 *  - timezone:  browser-detected IANA zone, persisted on first-time signup
 *  - survey:    URL-encoded JSON SignupSurvey from the qualifier flow
 */
export function startGoogleLogin(req: Request, res: Response): void {
  try {
    const returnTo = safeReturnTo(req.query.returnTo ?? "/dashboard");
    const timezone = normalizeTimezone(req.query.timezone);
    const survey = normalizeSignupSurvey(parseJsonParam(req.query.survey));

    const oauthClient = getOAuth2Client();
    const state = signLoginStateToken({ returnTo, timezone, survey });

    // access_type=offline requests a refresh token for Calendar sync. Google
    // grants one on the FIRST offline authorization without forcing the
    // consent interstitial, so most users see a single screen. `prompt` is
    // deliberately NOT "consent": returning users who already granted offline
    // access won't be re-issued a refresh token anyway, and re-showing the
    // full consent page is what made the old flow feel like a second login.
    // select_account keeps the account chooser so users can pick identities.
    const authUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      scope: GOOGLE_LOGIN_OAUTH_SCOPES,
      state,
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("startGoogleLogin error:", error);
    res.redirect(`${frontendUrl()}/auth/google/callback?error=server_error`);
  }
}

/** Leniently parse a JSON-encoded query param (null on garbage). */
function parseJsonParam(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/google/url
 * Returns a Google consent URL bound to the authenticated user via a signed
 * `state` token. access_type=offline + prompt=consent ensure a refresh token.
 * Accepts an optional `?returnTo=` path so the browser can be sent back to a
 * specific page (e.g. /onboarding) after consent.
 */
export async function getGoogleAuthUrl(
  req: Request,
  res: Response<{ authUrl: string } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const oauthClient = getOAuth2Client();
    const returnTo = safeReturnTo(req.query.returnTo);
    const state = signStateToken(req.user.uid, returnTo);

    const authUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_OAUTH_SCOPES,
      state,
    });

    res.json({ authUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build auth URL";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/auth/google/callback
 * OAuth redirect target (no auth header). Two modes, distinguished by the
 * signed state token:
 *  - login mode  (public): complete the merged sign-in + consent flow, then
 *    redirect to the frontend with a one-time code (never tokens in URLs).
 *  - connect mode (authenticated tutor): exchange the code for tokens and
 *    store the Calendar connection (the original Settings flow).
 */
export async function googleAuthCallback(
  req: Request,
  res: Response,
): Promise<void> {
  const { code, state, error } = req.query;

  const base = frontendUrl();
  const fail = (path = "/settings") =>
    res.redirect(`${base}${path}?google=error`);

  const stateStr = typeof state === "string" ? state : undefined;

  // ---- Login mode ---------------------------------------------------------
  const loginState = verifyLoginStateToken(stateStr);
  if (loginState) {
    await completeGoogleLogin(res, {
      code: typeof code === "string" ? code : undefined,
      denied: !!error,
      loginState,
    });
    return;
  }

  // ---- Connect mode (unchanged Settings flow) ------------------------------
  const statePayload = verifyStateToken(stateStr);
  const returnTo = safeReturnTo(statePayload?.returnTo);
  if (!statePayload?.uid || !code) {
    if (error) {
      fail();
      return;
    }
    fail(returnTo);
    return;
  }

  try {
    const oauthClient = getOAuth2Client();
    const { tokens } = await oauthClient.getToken(
      typeof code === "string" ? code : String(code),
    );

    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      // No refresh token usually means the account was connected before and
      // Google won't re-issue one without prompt=consent. Force a fresh grant.
      res.redirect(`${base}${returnTo}?google=no_refresh_token`);
      return;
    }

    const googleEmail = decodeEmailFromIdToken(tokens.id_token);

    await setGoogleConnection(statePayload.uid, {
      refreshToken,
      googleEmail,
    });

    // Best-effort backfill: push all upcoming lessons to Google Calendar.
    // Fire-and-forget (non-blocking) so the OAuth redirect resolves fast;
    // failures are logged and the tutor can re-run it from Settings.
    backfillUpcomingLessons(statePayload.uid).catch((err) => {
      console.error(
        "[calendar-backfill] Background backfill failed:",
        err instanceof Error ? err.message : err,
      );
    });

    res.redirect(`${base}${returnTo}?google=connected`);
  } catch (err) {
    console.error("googleAuthCallback error:", err);
    fail(returnTo);
  }
}

/**
 * Finish the merged Google login: verify Google's assertion, find-or-create
 * the Firebase + Firestore user, persist the Calendar connection when Google
 * granted a refresh token, then redirect to the frontend callback route with
 * a single-use code it can exchange for the app's tokens.
 */
async function completeGoogleLogin(
  res: Response,
  input: {
    code?: string;
    denied: boolean;
    loginState: { returnTo: string; timezone: string | null; survey: unknown };
  },
): Promise<void> {
  const base = frontendUrl();
  const loginFail = (reason: string) =>
    res.redirect(
      `${base}/auth/google/callback?error=${encodeURIComponent(reason)}`,
    );

  if (input.denied || !input.code) {
    loginFail("denied");
    return;
  }

  try {
    const oauthClient = getOAuth2Client();
    const { tokens } = await oauthClient.getToken(input.code);

    if (!tokens.id_token) {
      loginFail("server_error");
      return;
    }

    // Verify Google's signed ID-token assertion (audience = this OAuth
    // client). The token arrived over the back channel straight from Google's
    // token endpoint, but verifying it here is the textbook way to establish
    // the federated identity for a login.
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    // Never federate identity from an unverified email — doing so would let
    // an attacker claim an email/password account they don't own.
    if (!profile?.email || profile.email_verified !== true) {
      loginFail("email_not_verified");
      return;
    }

    const email = profile.email;
    const name = profile.name || email.split("@")[0];
    const avatarUrl = profile.picture ?? null;

    // Find-or-create the Firebase Auth record. An existing email/password
    // user signing in with Google lands on their SAME account (provider
    // linking semantics, matching Firebase's client-side popup behavior).
    const uid = await findOrCreateFirebaseUser({ email, name, avatarUrl });

    const existingUser = await getUserFromFirestore(uid).catch(() => null);
    const user = existingUser
      ? existingUser
      : await createUserInFirestore(
          uid,
          email,
          name,
          "tutor",
          avatarUrl,
          undefined,
          input.loginState.timezone,
          normalizeSignupSurvey(input.loginState.survey),
        );

    // Persist the Calendar connection when Google granted offline access.
    // First-time consents always include a refresh token; if the user had
    // previously authorized this client (e.g. via the old Firebase popup
    // flow) Google may omit one — login still succeeds, the tutor can
    // connect from Settings which forces a fresh grant.
    if (tokens.refresh_token) {
      await setGoogleConnection(uid, {
        refreshToken: tokens.refresh_token,
        googleEmail: email,
      });

      backfillUpcomingLessons(uid).catch((err) => {
        console.error(
          "[calendar-backfill] Background backfill failed:",
          err instanceof Error ? err.message : err,
        );
      });
    }

    const oneTimeCode = await createGoogleLoginCode({
      uid: user.id,
      isNewUser: !existingUser,
    });

    const returnTo = encodeURIComponent(input.loginState.returnTo);
    res.redirect(
      `${base}/auth/google/callback?code=${encodeURIComponent(oneTimeCode)}&returnTo=${returnTo}`,
    );
  } catch (err) {
    console.error("completeGoogleLogin error:", err);
    loginFail("server_error");
  }
}

/**
 * Find the Firebase Auth user by email, creating a verified record for
 * brand-new Google identities. Returns the uid.
 */
async function findOrCreateFirebaseUser(profile: {
  email: string;
  name: string;
  avatarUrl: string | null;
}): Promise<string> {
  const firebaseAuth = getFirebaseAuth();

  try {
    const existing = await firebaseAuth.getUserByEmail(profile.email);
    return existing.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") throw error;
  }

  try {
    const created = await firebaseAuth.createUser({
      email: profile.email,
      // Google has already verified this address — don't force a (looping)
      // verification email the user can't complete with Google SSO.
      emailVerified: true,
      displayName: profile.name,
      ...(profile.avatarUrl ? { photoURL: profile.avatarUrl } : {}),
    });
    return created.uid;
  } catch (error) {
    // Two first-ever logins racing: the loser's createUser fails with
    // auth/email-already-exists — resolve to the winner's record.
    if ((error as { code?: string }).code === "auth/email-already-exists") {
      const existing = await firebaseAuth.getUserByEmail(profile.email);
      return existing.uid;
    }
    throw error;
  }
}

/**
 * POST /api/auth/google/exchange
 * PUBLIC. Swap the one-time code from the merged-login redirect for the app's
 * JWT + refresh token pair (the back-channel half of the handshake — tokens
 * never appear in a URL). Mirrors the response shape of /api/auth/login.
 */
export async function exchangeGoogleLoginCode(
  req: Request,
  res: Response<LoginResponse | ApiError>,
): Promise<void> {
  try {
    const code = req.body?.code;
    const data =
      typeof code === "string" ? await consumeGoogleLoginCode(code) : null;

    if (!data) {
      res.status(401).json({
        message: "Invalid or expired sign-in code. Please try again.",
      });
      return;
    }

    const user = await getUserFromFirestore(data.uid);
    const { jwtToken, refreshToken } = await issueNewTokenPair(user);
    await updateLastActive(user.id);

    // Google asserted (and we verified) the email at consent time.
    res.status(200).json({
      jwtToken,
      refreshToken,
      user: toUserInfo(user, true),
      isNewUser: data.isNewUser,
    });
  } catch (error) {
    console.error("Google login code exchange failed:", error);
    const message =
      error instanceof Error ? error.message : "Google sign-in failed";
    res.status(401).json({ message });
  }
}

/**
 * GET /api/auth/google/status
 * Returns whether the authenticated user has connected a Google account.
 * Never exposes the refresh token.
 */
export async function getGoogleConnectionStatus(
  req: Request,
  res: Response<{ connected: boolean; googleEmail: string | null } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const connection = await getGoogleConnection(req.user.uid);
  res.json({
    connected: !!connection,
    googleEmail: connection?.googleEmail ?? null,
  });
}

/**
 * DELETE /api/auth/google
 * Disconnect the authenticated user's Google account (clears stored tokens).
 */
export async function disconnectGoogle(
  req: Request,
  res: Response<{ connected: boolean } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await clearGoogleConnection(req.user.uid);
  res.json({ connected: false });
}

/** Best-effort decode of the email from a Google id_token payload. */
function decodeEmailFromIdToken(idToken?: string | null): string {
  if (!idToken) return "";
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8"),
    );
    return json.email ?? "";
  } catch {
    return "";
  }
}
