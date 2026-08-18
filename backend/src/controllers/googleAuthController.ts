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
  type LoginStatePayload,
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
    // No default landing path: when the caller didn't send returnTo the
    // frontend callback page decides post-login routing (onboarding for
    // incomplete tutors, dashboard otherwise). Injecting /dashboard here
    // would override that check and skip onboarding for brand-new users
    // signing in via the login page's Google button.
    const returnTo =
      typeof req.query.returnTo === "string"
        ? safeReturnTo(req.query.returnTo)
        : null;
    const timezone = normalizeTimezone(req.query.timezone);
    const survey = normalizeSignupSurvey(parseJsonParam(req.query.survey));

    const oauthClient = getOAuth2Client();
    const state = signLoginStateToken({ returnTo, timezone, survey });

    // access_type=offline requests a refresh token for Calendar sync. With
    // plain select_account, Google shows the consent screen (and grants the
    // refresh token) only on a user's FIRST authorization — every later
    // sign-in is a single silent account-picker screen, matching the
    // Calendly-style "ask once" behaviour. The gap this leaves (a prior grant
    // with no stored connection returns no refresh token and sees no consent
    // screen) is patched by a one-time consent retry in completeGoogleLogin.
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

    const previous = await getGoogleConnection(statePayload.uid);
    await setGoogleConnection(statePayload.uid, {
      refreshToken,
      googleEmail,
    });
    revokeStaleGoogleToken(previous, refreshToken);

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
 *
 * Consent handling (Calendly-style "ask once"): when Google skips the consent
 * screen because of a prior grant, no refresh token comes back. If the tutor
 * also has no stored connection, they are bounced back to Google ONCE with
 * prompt=consent + login_hint (the verified email) to capture the offline
 * grant without re-showing the account picker; the verified identity rides in
 * the signed retry state so a declined retry still completes the sign-in
 * (Calendar stays unconnected, connectable later from Settings/onboarding).
 */
async function completeGoogleLogin(
  res: Response,
  input: {
    code?: string;
    denied: boolean;
    loginState: LoginStatePayload;
  },
): Promise<void> {
  const base = frontendUrl();
  const loginFail = (reason: string) =>
    res.redirect(
      `${base}/auth/google/callback?error=${encodeURIComponent(reason)}`,
    );

  if (input.denied || !input.code) {
    // Declined on the consent-retry pass: identity was already verified on
    // the first pass — finish signing in without the Calendar connection
    // instead of failing the login.
    if (input.loginState.retry?.uid) {
      await finishGoogleLoginForUid(
        res,
        input.loginState.retry.uid,
        input.loginState,
      );
      return;
    }
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

    if (tokens.refresh_token) {
      // Persist the Calendar connection: this pass carried the offline grant.
      const previous = await getGoogleConnection(uid);
      await setGoogleConnection(uid, {
        refreshToken: tokens.refresh_token,
        googleEmail: email,
      });
      revokeStaleGoogleToken(previous, tokens.refresh_token);

      backfillUpcomingLessons(uid).catch((err) => {
        console.error(
          "[calendar-backfill] Background backfill failed:",
          err instanceof Error ? err.message : err,
        );
      });
    } else if (!input.loginState.retry) {
      // Google omitted the refresh token: it skipped the consent screen
      // because this account granted the client before. Returning users with
      // a stored connection stay silent (nothing to do). Only when we hold no
      // connection either (grant predates this flow, or the user disconnected
      // — which revokes the grant) do we bounce back to Google ONCE with
      // prompt=consent to capture a fresh offline grant.
      const connection = await getGoogleConnection(uid);
      if (!connection) {
        const retryState = signLoginStateToken({
          returnTo: input.loginState.returnTo,
          timezone: input.loginState.timezone,
          survey: input.loginState.survey,
          retry: { uid, isNewUser: !existingUser },
        });

        // login_hint: the account was just picked on the first pass and its
        // email verified via the ID token. Hinting it makes Google skip the
        // account picker on this retry and show ONLY the consent screen —
        // without it the user would choose their account a second time.
        res.redirect(
          oauthClient.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            login_hint: email,
            scope: GOOGLE_LOGIN_OAUTH_SCOPES,
            state: retryState,
          }),
        );
        return;
      }
    }

    // On the retry pass the Firestore user was already created by the first
    // pass — trust the isNewUser flag from that pass so brand-new signups
    // still route into onboarding.
    const isNewUser = input.loginState.retry?.isNewUser ?? !existingUser;
    await issueGoogleLoginRedirect(res, user, isNewUser, input.loginState.returnTo);
  } catch (err) {
    console.error("completeGoogleLogin error:", err);
    loginFail("server_error");
  }
}

/**
 * Complete the sign-in for an identity verified on a previous pass (the uid
 * comes from our own signed retry state, not from Google), used when the
 * consent retry is declined. Calendar simply stays unconnected.
 */
async function finishGoogleLoginForUid(
  res: Response,
  uid: string,
  loginState: LoginStatePayload,
): Promise<void> {
  const user = await getUserFromFirestore(uid).catch(() => null);
  if (!user) {
    res.redirect(
      `${frontendUrl()}/auth/google/callback?error=${encodeURIComponent("server_error")}`,
    );
    return;
  }
  await issueGoogleLoginRedirect(
    res,
    user,
    loginState.retry?.isNewUser ?? false,
    loginState.returnTo,
  );
}

/** Mint the one-time login code and redirect to the frontend callback. */
async function issueGoogleLoginRedirect(
  res: Response,
  user: { id: string },
  isNewUser: boolean,
  returnTo: string | null,
): Promise<void> {
  const oneTimeCode = await createGoogleLoginCode({ uid: user.id, isNewUser });
  const returnParam = returnTo
    ? `&returnTo=${encodeURIComponent(returnTo)}`
    : "";
  res.redirect(
    `${frontendUrl()}/auth/google/callback?code=${encodeURIComponent(oneTimeCode)}${returnParam}`,
  );
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
 * Disconnect the authenticated user's Google account: clears the stored
 * tokens locally and best-effort revokes the grant server-side at Google so
 * the app's access actually ends (not just our copy of it).
 */
export async function disconnectGoogle(
  req: Request,
  res: Response<{ connected: boolean } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const connection = await getGoogleConnection(req.user.uid);
  await clearGoogleConnection(req.user.uid);

  // Local state is already cleared — revoke at Google without blocking the
  // response (a Google outage must not stop a user disconnecting).
  if (connection?.refreshToken) {
    revokeGoogleTokenQuietly(connection.refreshToken);
  }

  res.json({ connected: false });
}

/** Best-effort revoke of the email from a Google id_token payload. */
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

/**
 * Best-effort revocation of a Google refresh token at Google's end. Local
 * state is always the source of truth and is cleared/overwritten by the
 * caller BEFORE this runs — a revoke failure (network, already-revoked,
 * Google hiccup) must never fail the user's disconnect/reconnect, so the
 * promise is only observed for logging.
 */
function revokeGoogleTokenQuietly(refreshToken: string): void {
  getOAuth2Client()
    .revokeToken(refreshToken)
    .catch((err) => {
      console.warn(
        "[google-oauth] Failed to revoke refresh token at Google:",
        err instanceof Error ? err.message : err,
      );
    });
}

/**
 * When a fresh grant replaces a previous connection, revoke the superseded
 * refresh token so no orphaned grant lingers on the user's Google account.
 * Guarded against the (rare) case where Google re-issues the SAME refresh
 * token for a re-grant — revoking the token we just stored would kill the
 * new connection.
 */
function revokeStaleGoogleToken(previous: {
  refreshToken?: string;
} | null, next: string): void {
  if (previous?.refreshToken && previous.refreshToken !== next) {
    revokeGoogleTokenQuietly(previous.refreshToken);
  }
}
