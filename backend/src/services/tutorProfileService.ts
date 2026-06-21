import { getFirebaseFirestore } from "../config/firebase";
import { getUserFromFirestore } from "./userService";
import type {
  UpdateTutorProfileRequest,
  PublicTutorProfileResponse,
  TutorTemplate,
} from "@examify-tms/interfaces";
import admin from "firebase-admin";

/**
 * Internal representation of a tutor profile with Date timestamps
 * (Firestore Timestamps converted to JS Dates at read time).
 */
export interface TutorProfileData {
  id: string;
  tutorId: string;
  slug: string;
  template: TutorTemplate;
  status: "draft" | "published";
  headline: string | null;
  bio: string | null;
  subjects: string[];
  qualifications: string[];
  hourlyRate: number | null;
  currency: string;
  contactEmail: string | null;
  ctaText: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

/** Slugs that must never be claimed (would shadow app/reserved routes). */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "t",
  "www",
  "settings",
  "dashboard",
  "login",
  "signup",
]);

/** A slug must be 3-40 lowercase letters, digits or hyphens. */
const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

/** Custom error thrown when a slug is invalid or already taken. */
export class SlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlugError";
  }
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function mapDocToProfile(
  id: string,
  data: admin.firestore.DocumentData
): TutorProfileData {
  return {
    id,
    tutorId: data.tutorId,
    slug: data.slug,
    template: data.template ?? "classic",
    status: data.status ?? "draft",
    headline: data.headline ?? null,
    bio: data.bio ?? null,
    subjects: data.subjects ?? [],
    qualifications: data.qualifications ?? [],
    hourlyRate:
      typeof data.hourlyRate === "number" ? data.hourlyRate : null,
    currency: data.currency ?? "USD",
    contactEmail: data.contactEmail ?? null,
    ctaText: data.ctaText ?? null,
    createdAt: data.createdAt?.toDate() ?? (null as any),
    updatedAt: data.updatedAt?.toDate() ?? (null as any),
    publishedAt: data.publishedAt ? data.publishedAt.toDate() : null,
  };
}

/**
 * Get a tutor's profile by their user UID (the document ID).
 * Returns null if the tutor has not created a profile yet.
 */
export async function getProfileByTutorId(
  tutorId: string
): Promise<TutorProfileData | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("tutorProfiles").doc(tutorId).get();

    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;

    return mapDocToProfile(doc.id, data);
  } catch (error) {
    console.error("Failed to get tutor profile from Firestore:", error);
    throw new Error("Failed to get tutor profile");
  }
}

/**
 * Find a published profile by slug. Returns null if no published profile
 * uses that slug.
 */
export async function getPublishedProfileBySlug(
  slug: string
): Promise<TutorProfileData | null> {
  try {
    const firestore = getFirebaseFirestore();
    const normalized = normalizeSlug(slug);
    const snapshot = await firestore
      .collection("tutorProfiles")
      .where("slug", "==", normalized)
      .where("status", "==", "published")
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return mapDocToProfile(doc.id, doc.data());
  } catch (error) {
    console.error("Failed to get published profile by slug:", error);
    throw new Error("Failed to get published profile");
  }
}

/**
 * Check whether a slug is available for the given tutor.
 * True when free, or already owned by the same tutor. Throws SlugError for
 * malformed or reserved slugs so callers can return a 400.
 */
export async function isSlugAvailable(
  tutorId: string,
  slug: string
): Promise<boolean> {
  const normalized = normalizeSlug(slug);

  if (!SLUG_PATTERN.test(normalized)) {
    throw new SlugError(
      "Slug must be 3-40 characters: lowercase letters, digits and hyphens only."
    );
  }
  if (RESERVED_SLUGS.has(normalized)) {
    throw new SlugError("That slug is reserved. Please choose another.");
  }

  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("tutorProfiles")
    .where("slug", "==", normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return true;

  // Available if the existing profile belongs to this tutor already.
  return snapshot.docs[0].id === tutorId;
}

/**
 * Create or update the authenticated tutor's profile with the provided
 * editable fields. Validates slug format and uniqueness. Stamps updatedAt
 * (and createdAt on first save). Never changes status here.
 */
export async function upsertProfile(
  tutorId: string,
  data: UpdateTutorProfileRequest
): Promise<TutorProfileData> {
  try {
    const normalized = normalizeSlug(data.slug);

    if (!SLUG_PATTERN.test(normalized)) {
      throw new SlugError(
        "Slug must be 3-40 characters: lowercase letters, digits and hyphens only."
      );
    }
    if (RESERVED_SLUGS.has(normalized)) {
      throw new SlugError("That slug is reserved. Please choose another.");
    }

    // Uniqueness check across other tutors.
    const firestore = getFirebaseFirestore();
    const existingSlugSnap = await firestore
      .collection("tutorProfiles")
      .where("slug", "==", normalized)
      .limit(1)
      .get();
    if (!existingSlugSnap.empty && existingSlugSnap.docs[0].id !== tutorId) {
      throw new SlugError("That slug is already taken. Please choose another.");
    }

    const docRef = firestore.collection("tutorProfiles").doc(tutorId);
    const existing = await docRef.get();
    const now = admin.firestore.Timestamp.now();

    const profileData: Record<string, unknown> = {
      slug: normalized,
      template: data.template ?? "classic",
      headline: data.headline ?? null,
      bio: data.bio ?? null,
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      qualifications: Array.isArray(data.qualifications)
        ? data.qualifications
        : [],
      hourlyRate: data.hourlyRate ?? null,
      currency: data.currency || "USD",
      contactEmail: data.contactEmail ?? null,
      ctaText: data.ctaText ?? null,
      tutorId,
      updatedAt: now,
    };

    if (!existing.exists) {
      profileData.status = "draft";
      profileData.createdAt = now;
      profileData.publishedAt = null;
      await docRef.set(profileData, { merge: true });
    } else {
      await docRef.update(profileData);
    }

    return (await getProfileByTutorId(tutorId))!;
  } catch (error) {
    if (error instanceof SlugError) throw error;
    console.error("Failed to upsert tutor profile:", error);
    throw new Error("Failed to save tutor profile");
  }
}

/**
 * Set a profile's publication state. Publishing stamps publishedAt.
 * Returns the updated profile, or null if the tutor has no profile yet.
 */
export async function setProfileStatus(
  tutorId: string,
  status: "draft" | "published"
): Promise<TutorProfileData | null> {
  try {
    const firestore = getFirebaseFirestore();
    const docRef = firestore.collection("tutorProfiles").doc(tutorId);
    const existing = await docRef.get();
    if (!existing.exists) return null;

    const now = admin.firestore.Timestamp.now();
    const updateData: Record<string, unknown> = { status, updatedAt: now };
    if (status === "published") {
      updateData.publishedAt = now;
    }
    await docRef.update(updateData);

    return getProfileByTutorId(tutorId);
  } catch (error) {
    console.error("Failed to update tutor profile status:", error);
    throw new Error("Failed to update publication status");
  }
}

/**
 * Build the public-facing profile payload by joining the profile content
 * with the tutor's display name and avatar from their user record.
 * Returns null if no published profile exists for the slug.
 */
export async function getPublicProfileBySlug(
  slug: string
): Promise<PublicTutorProfileResponse | null> {
  const profile = await getPublishedProfileBySlug(slug);
  if (!profile) return null;

  let name = "Tutor";
  let avatarUrl: string | null = null;
  try {
    const user = await getUserFromFirestore(profile.tutorId);
    name = user.name;
    avatarUrl = user.avatarUrl ?? null;
  } catch {
    // Fall back to a generic name if the user record is somehow missing.
  }

  return {
    slug: profile.slug,
    template: profile.template,
    headline: profile.headline,
    bio: profile.bio,
    subjects: profile.subjects,
    qualifications: profile.qualifications,
    hourlyRate: profile.hourlyRate,
    currency: profile.currency,
    contactEmail: profile.contactEmail,
    ctaText: profile.ctaText,
    name,
    avatarUrl,
  };
}
