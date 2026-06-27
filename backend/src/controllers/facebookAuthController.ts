import { Request, Response } from "express";
import { ApiError } from "@examify-tms/interfaces";
import { buildAuthUrl } from "../config/facebookOAuth";
import { signStateToken, verifyStateToken } from "../utils/jwt";
import {
  setFacebookConnection,
  getFacebookConnection,
  clearFacebookConnection,
  setFacebookPendingConnection,
  getFacebookPendingConnection,
  clearFacebookPendingConnection,
} from "../services/userService";
import {
  exchangeCodeForUserToken,
  exchangeLongLivedUserToken,
  listPages,
} from "../services/facebookService";

function frontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
}

/**
 * Coerce a caller-supplied return path into something safe to redirect to.
 * Only same-origin absolute paths are allowed (must start with a single "/",
 * never "//"), otherwise we fall back to /marketing.
 */
function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/marketing";
  }
  return raw;
}

/**
 * GET /api/auth/facebook/url
 * Returns a Facebook consent URL bound to the authenticated user via a signed
 * `state` token.
 */
export async function getFacebookAuthUrl(
  req: Request,
  res: Response<{ authUrl: string } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const returnTo = safeReturnTo(req.query.returnTo);
    const state = signStateToken(req.user.uid, returnTo);
    const authUrl = buildAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build auth URL";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/auth/facebook/callback
 * OAuth redirect target (no auth header). Verifies the signed state to recover
 * the uid (+ returnTo), exchanges the code for a long-lived user token, lists
 * the user's Pages, and:
 *  - 0 Pages → redirect with ?fb=no_pages
 *  - 1 Page  → persist the connection, redirect with ?fb=connected
 *  - >1 Page → stash the pending choice so the frontend can finalize via
 *              POST /api/auth/facebook/page; redirect with ?fb=select_pages
 */
export async function facebookAuthCallback(
  req: Request,
  res: Response,
): Promise<void> {
  const { code, state, error } = req.query;

  const base = frontendUrl();
  const fail = (path = "/marketing") =>
    res.redirect(`${base}${path}?fb=error`);

  if (error) {
    fail();
    return;
  }

  const statePayload = verifyStateToken(
    typeof state === "string" ? state : undefined,
  );
  const returnTo = safeReturnTo(statePayload?.returnTo);
  if (!statePayload?.uid || !code) {
    fail(returnTo);
    return;
  }

  try {
    const shortToken = await exchangeCodeForUserToken(String(code));
    const longToken = await exchangeLongLivedUserToken(shortToken);
    const pages = await listPages(longToken);

    if (pages.length === 0) {
      res.redirect(`${base}${returnTo}?fb=no_pages`);
      return;
    }

    if (pages.length === 1) {
      const page = pages[0];
      await setFacebookConnection(statePayload.uid, {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        userAccessToken: longToken,
      });
      res.redirect(`${base}${returnTo}?fb=connected`);
      return;
    }

    // Multiple Pages: stash the user token + candidate list so the frontend
    // page-picker can finalize. Stored on the user doc (cleared on
    // finalize/disconnect).
    await setFacebookPendingConnection(statePayload.uid, {
      userAccessToken: longToken,
      pages,
    });
    res.redirect(`${base}${returnTo}?fb=select_pages`);
  } catch (err) {
    console.error("facebookAuthCallback error:", err);
    fail(returnTo);
  }
}

/**
 * GET /api/auth/facebook/status
 * Returns whether the authenticated user has connected a Facebook Page. Never
 * exposes the access token.
 */
export async function getFacebookConnectionStatus(
  req: Request,
  res: Response<{ connected: boolean; pageId: string | null; pageName: string | null } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const connection = await getFacebookConnection(req.user.uid);
  if (!connection) {
    res.json({ connected: false, pageId: null, pageName: null });
    return;
  }
  res.json({
    connected: true,
    pageId: connection.pageId,
    pageName: connection.pageName,
  });
}

/**
 * POST /api/auth/facebook/page
 * Finalize a multi-Page connection by selecting which Page to use. Body:
 * `{ pageId }`. Requires a pending connection from a prior callback.
 */
export async function selectFacebookPage(
  req: Request,
  res: Response<{ connected: boolean } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const pageId = typeof req.body?.pageId === "string" ? req.body.pageId : null;
  if (!pageId) {
    res.status(400).json({ message: "pageId is required" });
    return;
  }

  try {
    const pending = await getFacebookPendingConnection(req.user.uid);
    if (!pending) {
      res.status(409).json({
        message: "No pending Facebook connection. Reconnect your account.",
      });
      return;
    }
    const page = pending.pages.find((p) => p.id === pageId);
    if (!page) {
      res.status(400).json({ message: "Selected Page was not found." });
      return;
    }

    await setFacebookConnection(req.user.uid, {
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      userAccessToken: pending.userAccessToken,
    });
    await clearFacebookPendingConnection(req.user.uid);
    res.json({ connected: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to select Page";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/auth/facebook/pages
 * List the Pages the user can choose from (drives the multi-Page picker).
 * Requires a pending connection.
 */
export async function listFacebookPages(
  req: Request,
  res: Response<{ pages: { id: string; name: string }[] } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const pending = await getFacebookPendingConnection(req.user.uid);
  res.json({
    pages: (pending?.pages ?? []).map((p) => ({ id: p.id, name: p.name })),
  });
}

/**
 * DELETE /api/auth/facebook
 * Disconnect the authenticated user's Facebook account (clears stored tokens
 * + any pending selection).
 */
export async function disconnectFacebook(
  req: Request,
  res: Response<{ connected: boolean } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  await clearFacebookConnection(req.user.uid);
  await clearFacebookPendingConnection(req.user.uid);
  res.json({ connected: false });
}
