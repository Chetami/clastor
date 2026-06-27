import crypto from "crypto";

/**
 * Graph API version used for every Facebook endpoint. Pinned in one place so
 * a version bump is a single edit.
 */
export const FB_GRAPH_VERSION = "v19.0";

/**
 * Scopes requested when a tutor connects their Facebook account. The app must
 * have advanced access to these (or be in Development mode with the user added
 * as a tester) for the grant to succeed:
 *  - pages_show_list: list the Pages the user manages (page picker).
 *  - pages_read_engagement: read Page content / insights (base requirement for
 *    many Page endpoints under App Review).
 *  - pages_manage_posts: publish posts to the Page.
 */
export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
];

/**
 * Validate that the Facebook OAuth env vars are present. Mirrors the guard in
 * googleOAuth.getOAuth2Client(). Throws a clear error so missing config fails
 * fast at request time rather than producing cryptic Graph errors.
 */
export function requireFacebookConfig() {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      "Facebook OAuth is not configured. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET and FACEBOOK_REDIRECT_URI in the backend environment.",
    );
  }
  return { appId, appSecret, redirectUri };
}

/**
 * Build the Facebook OAuth consent URL bound to the authenticated user via a
 * signed `state` token (the browser can't send the auth header on the
 * redirect, so identity is recovered from `state` in the callback).
 */
export function buildAuthUrl(state: string): string {
  const { appId, redirectUri } = requireFacebookConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: FACEBOOK_SCOPES.join(","),
  });
  return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Base Graph API host for the pinned version. */
export function graphBaseUrl(): string {
  return `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
}

/**
 * Compute the appsecret_proof (HMAC-SHA256 of the access token using the app
 * secret). Meta requires (or strongly recommends) this on all server-to-Graph
 * calls when "Require App Secret" / proof is enabled on the app. Cheap to
 * always include.
 */
export function appsecretProof(accessToken: string): string {
  const { appSecret } = requireFacebookConfig();
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}
