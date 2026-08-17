import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
  publishMyProfile,
  unpublishMyProfile,
  checkSlug,
  getPublicProfile,
} from "../controllers/tutorProfileController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { requireFeature } from "../middleware/featureFlags";
import { publicProfileLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * GET /api/tutor-profiles/public/:slug
 * Public endpoint (no auth) — returns a published profile for anyone.
 * Rate-limited: slugs are guessable, so cap scraping well above browse rate.
 */
router.get("/public/:slug", publicProfileLimiter, requireFeature("publicProfile"), getPublicProfile);

/**
 * GET /api/tutor-profiles/check-slug?slug=...
 * Reports slug availability for the authenticated tutor.
 */
router.get("/check-slug", authenticateJWT, checkSlug);

/**
 * GET /api/tutor-profiles/me
 * Returns the authenticated tutor's own profile.
 */
router.get("/me", authenticateJWT, getMyProfile);

/**
 * PUT /api/tutor-profiles/me
 * Creates or updates the authenticated tutor's profile (draft fields).
 */
router.put(
  "/me",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  updateMyProfile
);

/**
 * POST /api/tutor-profiles/me/publish
 * Publishes the authenticated tutor's profile.
 */
router.post("/me/publish", authenticateJWT, publishMyProfile);

/**
 * POST /api/tutor-profiles/me/unpublish
 * Returns the authenticated tutor's profile to draft state.
 */
router.post("/me/unpublish", authenticateJWT, unpublishMyProfile);

export default router;
