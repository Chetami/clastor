import { google } from "googleapis";

/**
 * Scopes requested when a tutor connects their Google account.
 *  - calendar.events: create/update Calendar events (needed to provision a
 *    Google Meet conference via a backing event).
 *  - openid + email: identify which Google account was connected.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

/**
 * Scopes requested by the merged Google LOGIN flow (public redirect-based
 * sign-in). In addition to the connect-flow scopes this includes `profile`
 * so a brand-new user's display name and avatar can be seeded from their
 * Google profile. Requesting everything up front means ONE Google consent
 * screen covers both sign-in and the Calendar offline grant.
 */
export const GOOGLE_LOGIN_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

let sharedClient: InstanceType<typeof google.auth.OAuth2> | null = null;

/**
 * Lazily build the shared OAuth2 client configured from env vars. This client
 * is used to generate consent URLs and exchange authorization codes; per-user
 * credentials are then applied to copies as needed.
 */
export function getOAuth2Client() {
  if (sharedClient) {
    return sharedClient;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI in the backend environment.",
    );
  }

  sharedClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return sharedClient;
}

/**
 * Build a fresh OAuth2 client authenticated as a specific tutor (using their
 * stored refresh token). googleapis auto-refreshes short-lived access tokens.
 */
export function getOAuth2ClientForUser(refreshToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
