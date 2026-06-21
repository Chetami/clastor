import { Request, Response } from "express";
import {
  getProfileByTutorId,
  upsertProfile,
  setProfileStatus,
  getPublicProfileBySlug,
  isSlugAvailable,
  SlugError,
  TutorProfileData,
} from "../services/tutorProfileService";
import type {
  UpdateTutorProfileRequest,
  TutorProfileResponse,
  PublicTutorProfileResponse,
  CheckSlugResponse,
  ApiError,
} from "@examify-tms/interfaces";

function toIso(date: Date | null): string | null {
  return date instanceof Date ? date.toISOString() : date;
}

function toResponse(profile: TutorProfileData): TutorProfileResponse {
  return {
    id: profile.id,
    tutorId: profile.tutorId,
    slug: profile.slug,
    template: profile.template,
    status: profile.status,
    headline: profile.headline,
    bio: profile.bio,
    subjects: profile.subjects,
    qualifications: profile.qualifications,
    hourlyRate: profile.hourlyRate,
    currency: profile.currency,
    contactEmail: profile.contactEmail,
    ctaText: profile.ctaText,
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

    res.status(200).json(toResponse(profile));
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
    res.status(200).json(toResponse(profile));
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

    res.status(200).json(toResponse(profile));
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

    res.status(200).json(toResponse(profile));
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
