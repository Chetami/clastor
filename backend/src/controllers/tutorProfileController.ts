import { Request, Response } from "express";
import {
  getProfileByTutorId,
  upsertProfile,
  setProfileStatus,
  getPublicProfileBySlug,
  getPublishedProfileBySlug,
  isSlugAvailable,
  listPublicProfiles,
  resolveProfileSubjects,
  buildAvailability,
  SlugError,
  TutorProfileData,
} from "../services/tutorProfileService";
import {
  createReview,
  listPublicReviews,
  listTutorReviews,
  setReviewStatus,
} from "../services/tutorReviewService";
import { getUserFromFirestore } from "../services/userService";
import { AppError } from "../utils/AppError";
import type {
  UpdateTutorProfileRequest,
  TutorProfileResponse,
  PublicTutorProfileResponse,
  PublicTutorListResponse,
  PublicTutorReviewListResponse,
  TutorReviewListResponse,
  TutorReview,
  CheckSlugResponse,
  ApiError,
  Subject,
} from "@examify-tms/interfaces";

function toIso(date: Date | null): string | null {
  return date instanceof Date ? date.toISOString() : date;
}

/**
 * Build the owner-facing response, resolving subjectIds against the tutor's
 * live catalogue and deriving availability from their working hours.
 */
async function toResponse(
  profile: TutorProfileData
): Promise<TutorProfileResponse> {
  let catalogue: Subject[] = [];
  let availability: ReturnType<typeof buildAvailability> = [];
  try {
    const user = await getUserFromFirestore(profile.tutorId);
    catalogue = user.subjects ?? [];
    availability = buildAvailability(user.workingHours ?? null);
  } catch {
    // Catalogue unavailable — fall back to name-only resolution.
  }

  return {
    id: profile.id,
    tutorId: profile.tutorId,
    slug: profile.slug,
    template: profile.template,
    status: profile.status,
    headline: profile.headline,
    bio: profile.bio,
    subjects: resolveProfileSubjects(
      profile.subjectIds,
      profile.legacySubjects,
      catalogue
    ),
    qualifications: profile.qualifications,
    hourlyRate: profile.hourlyRate,
    currency: profile.currency,
    location: profile.location,
    teachesOnline: profile.teachesOnline,
    yearsExperience: profile.yearsExperience,
    contactEmail: profile.contactEmail,
    ctaText: profile.ctaText,
    availability,
    ratingAvg: profile.ratingAvg,
    reviewCount: profile.reviewCount,
    createdAt: toIso(profile.createdAt) as string,
    updatedAt: toIso(profile.updatedAt) as string,
    publishedAt: toIso(profile.publishedAt),
  };
}

/**
 * GET /api/tutor-profiles/me
 * Returns the authenticated tutor's profile, or 404 if none exists yet.
 */
export async function getMyProfile(
  req: Request,
  res: Response<TutorProfileResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const profile = await getProfileByTutorId(req.user.uid);
    if (!profile) {
      res.status(404).json({ message: "No profile found" });
      return;
    }

    res.status(200).json(await toResponse(profile));
  } catch (error) {
    console.error("Get tutor profile failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get profile";
    res.status(500).json({ message });
  }
}

/**
 * PUT /api/tutor-profiles/me
 * Creates or updates the authenticated tutor's profile (draft fields).
 */
export async function updateMyProfile(
  req: Request<{}, {}, UpdateTutorProfileRequest>,
  res: Response<TutorProfileResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const profile = await upsertProfile(req.user.uid, req.body);
    res.status(200).json(await toResponse(profile));
  } catch (error) {
    if (error instanceof SlugError) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error("Update tutor profile failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save profile";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/tutor-profiles/me/publish
 * Marks the authenticated tutor's profile as published.
 */
export async function publishMyProfile(
  req: Request,
  res: Response<TutorProfileResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const profile = await setProfileStatus(req.user.uid, "published");
    if (!profile) {
      res.status(404).json({
        message: "Save your profile before publishing it.",
      });
      return;
    }

    res.status(200).json(await toResponse(profile));
  } catch (error) {
    console.error("Publish tutor profile failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to publish profile";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/tutor-profiles/me/unpublish
 * Returns the authenticated tutor's profile to draft state.
 */
export async function unpublishMyProfile(
  req: Request,
  res: Response<TutorProfileResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const profile = await setProfileStatus(req.user.uid, "draft");
    if (!profile) {
      res.status(404).json({ message: "No profile found" });
      return;
    }

    res.status(200).json(await toResponse(profile));
  } catch (error) {
    console.error("Unpublish tutor profile failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to unpublish profile";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/tutor-profiles/check-slug?slug=...
 * Reports whether a slug is available for the authenticated tutor.
 */
export async function checkSlug(
  req: Request,
  res: Response<CheckSlugResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const slug = (req.query.slug as string | undefined) ?? "";
    if (!slug.trim()) {
      res.status(400).json({ message: "Slug is required" });
      return;
    }

    const available = await isSlugAvailable(req.user.uid, slug);
    res.status(200).json({
      slug: slug.trim().toLowerCase(),
      available,
    });
  } catch (error) {
    if (error instanceof SlugError) {
      // Malformed/reserved slug reports as unavailable with the reason.
      res.status(200).json({
        slug: String(req.query.slug ?? "")
          .trim()
          .toLowerCase(),
        available: false,
      });
      return;
    }
    console.error("Check slug failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to check slug";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/tutor-profiles/public/:slug
 * Public endpoint (no auth). Returns a published profile joined with the
 * tutor's name + avatar, or 404 if not published / not found.
 */
export async function getPublicProfile(
  req: Request<{ slug: string }>,
  res: Response<PublicTutorProfileResponse | ApiError>
): Promise<void> {
  try {
    const profile = await getPublicProfileBySlug(req.params.slug);
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Get public profile failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get profile";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/tutor-profiles/directory
 * Public endpoint (no auth). Lists published profiles with in-memory
 * search/subject/online/rate filtering.
 */
export async function listPublicTutors(
  req: Request,
  res: Response<PublicTutorListResponse | ApiError>
): Promise<void> {
  try {
    const { search, subject, online, maxRate, sort, limit } = req.query as {
      search?: string;
      subject?: string;
      online?: boolean;
      maxRate?: number;
      sort?: "recent" | "rating";
      limit?: number;
    };

    const result = await listPublicProfiles({
      search,
      subject,
      online,
      maxRate,
      sort,
      limit,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("List public tutors failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list tutors";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/tutor-profiles/public/:slug/reviews
 * Public endpoint (no auth, tightly rate-limited). Submits a pending
 * review for a published profile.
 */
export async function createPublicReview(
  req: Request<{ slug: string }>,
  res: Response<TutorReview | ApiError>
): Promise<void> {
  try {
    const review = await createReview(req.params.slug, req.body);
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error("Create tutor review failed:", error);
    res.status(500).json({ message: "Failed to submit review" });
  }
}

/**
 * GET /api/tutor-profiles/public/:slug/reviews
 * Public endpoint (no auth). Approved reviews for a published profile.
 */
export async function listPublicProfileReviews(
  req: Request<{ slug: string }>,
  res: Response<PublicTutorReviewListResponse | ApiError>
): Promise<void> {
  try {
    const profile = await getPublishedProfileBySlug(req.params.slug);
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const items = await listPublicReviews(profile.tutorId);
    res.status(200).json({ items });
  } catch (error) {
    console.error("List public reviews failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list reviews";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/tutor-profiles/me/reviews
 * Every review about the authenticated tutor (all moderation statuses).
 */
export async function getMyReviews(
  req: Request,
  res: Response<TutorReviewListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const items = await listTutorReviews(req.user.uid);
    res.status(200).json({ items });
  } catch (error) {
    console.error("Get tutor reviews failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get reviews";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/tutor-profiles/me/reviews/:reviewId/approve | /reject
 * Moderates a review owned by the authenticated tutor.
 */
export async function moderateMyReview(
  req: Request<{ reviewId: string }, {}, { status: "approved" | "rejected" }>,
  res: Response<TutorReview | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const review = await setReviewStatus(
      req.user.uid,
      req.params.reviewId,
      req.body.status
    );
    res.status(200).json(review);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error("Moderate tutor review failed:", error);
    res.status(500).json({ message: "Failed to update review" });
  }
}
