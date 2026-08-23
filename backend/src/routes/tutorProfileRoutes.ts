import { Router, Request } from "express";
import {
  getMyProfile,
  updateMyProfile,
  publishMyProfile,
  unpublishMyProfile,
  checkSlug,
  getPublicProfile,
  listPublicTutors,
  createPublicReview,
  listPublicProfileReviews,
  getMyReviews,
  moderateMyReview,
} from "../controllers/tutorProfileController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { requireFeature } from "../middleware/featureFlags";
import { validateRequest } from "../middleware/validateRequest";
import {
  directoryLimiter,
  publicProfileLimiter,
  reviewSubmitLimiter,
} from "../middleware/rateLimit";
import {
  createTutorReviewSchema,
  listPublicTutorsQuerySchema,
  updateTutorProfileSchema,
} from "../schemas/tutorProfile";

const router = Router();

/**
 * GET /api/tutor-profiles/directory
 * Public endpoint (no auth) — searchable listing of published profiles.
 */
router.get(
  "/directory",
  directoryLimiter,
  requireFeature("publicProfile"),
  validateRequest({ query: listPublicTutorsQuerySchema }),
  listPublicTutors
);

/**
 * GET /api/tutor-profiles/public/:slug
 * Public endpoint (no auth) — returns a published profile for anyone.
 * Rate-limited: slugs are guessable, so cap scraping well above browse rate.
 */
router.get("/public/:slug", publicProfileLimiter, requireFeature("publicProfile"), getPublicProfile);

/**
 * GET /api/tutor-profiles/public/:slug/reviews
 * Public endpoint (no auth) — approved reviews for a published profile.
 */
router.get(
  "/public/:slug/reviews",
  publicProfileLimiter,
  requireFeature("publicProfile"),
  listPublicProfileReviews
);

/**
 * POST /api/tutor-profiles/public/:slug/reviews
 * Public review submission. Starts pending; the tutor approves/rejects it.
 * Tightly rate-limited: unauthenticated writes into Firestore.
 */
router.post(
  "/public/:slug/reviews",
  reviewSubmitLimiter,
  requireFeature("publicProfile"),
  validateRequest({ body: createTutorReviewSchema }),
  createPublicReview
);

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
  validateRequest({ body: updateTutorProfileSchema }),
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

/**
 * GET /api/tutor-profiles/me/reviews
 * Every review about the authenticated tutor (all statuses).
 */
router.get("/me/reviews", authenticateJWT, getMyReviews);

/**
 * POST /api/tutor-profiles/me/reviews/:reviewId/approve
 * POST /api/tutor-profiles/me/reviews/:reviewId/reject
 * Moderates a review owned by the authenticated tutor.
 */
router.post(
  "/me/reviews/:reviewId/:action(approve|reject)",
  authenticateJWT,
  (req: Request<{ reviewId: string; action: string }>, _res, next) => {
    req.body = {
      status: req.params.action === "approve" ? "approved" : "rejected",
    };
    next();
  },
  moderateMyReview
);

export default router;
