import { Request, Response } from "express";
import { ApiError } from "@examify-tms/interfaces";
import { getOAuth2Client, GOOGLE_OAUTH_SCOPES } from "../config/googleOAuth";
import { signStateToken, verifyStateToken } from "../utils/jwt";
import {
  setGoogleConnection,
  getGoogleConnection,
  clearGoogleConnection,
} from "../services/userService";

function frontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
}

/**
 * GET /api/auth/google/url
 * Returns a Google consent URL bound to the authenticated user via a signed
 * `state` token. access_type=offline + prompt=consent ensure a refresh token.
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
    const state = signStateToken(req.user.uid);

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
 * OAuth redirect target (no auth header). Verifies the signed state to recover
 * the uid, exchanges the code for tokens, and stores the connection.
 */
export async function googleAuthCallback(
  req: Request,
  res: Response,
): Promise<void> {
  const { code, state, error } = req.query;

  const base = frontendUrl();
  if (error) {
    res.redirect(`${base}/settings?google=error`);
    return;
  }

  const uid = verifyStateToken(typeof state === "string" ? state : undefined);
  if (!uid || !code) {
    res.redirect(`${base}/settings?google=error`);
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
      res.redirect(`${base}/settings?google=no_refresh_token`);
      return;
    }

    const googleEmail = decodeEmailFromIdToken(tokens.id_token);

    await setGoogleConnection(uid, { refreshToken, googleEmail });
    res.redirect(`${base}/settings?google=connected`);
  } catch (err) {
    console.error("googleAuthCallback error:", err);
    res.redirect(`${base}/settings?google=error`);
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
