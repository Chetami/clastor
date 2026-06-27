import { Router } from "express";
import {
  getFacebookAuthUrl,
  facebookAuthCallback,
  getFacebookConnectionStatus,
  selectFacebookPage,
  listFacebookPages,
  disconnectFacebook,
} from "../controllers/facebookAuthController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

/**
 * GET /api/auth/facebook/url
 * Get a Facebook OAuth consent URL for the authenticated tutor.
 */
router.get("/url", authenticateJWT, getFacebookAuthUrl);

/**
 * GET /api/auth/facebook/callback
 * OAuth redirect target (no auth header — identity comes from signed state).
 */
router.get("/callback", facebookAuthCallback);

/**
 * GET /api/auth/facebook/status
 * Whether the tutor has connected a Facebook Page.
 */
router.get("/status", authenticateJWT, getFacebookConnectionStatus);

/**
 * GET /api/auth/facebook/pages
 * Pages available to select (used by the multi-Page picker).
 */
router.get("/pages", authenticateJWT, listFacebookPages);

/**
 * POST /api/auth/facebook/page
 * Finalize a multi-Page connection by selecting a Page.
 */
router.post("/page", authenticateJWT, selectFacebookPage);

/**
 * DELETE /api/auth/facebook
 * Disconnect the tutor's Facebook account.
 */
router.delete("/", authenticateJWT, disconnectFacebook);

export default router;
