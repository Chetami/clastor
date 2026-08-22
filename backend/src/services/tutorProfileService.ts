import { getFirebaseFirestore } from "../config/firebase";
import { getUserFromFirestore } from "./userService";
import type {
  AvailabilitySlot,
  PublicTutorListResponse,
  PublicTutorSummary,
  Subject,
  UpdateTutorProfileRequest,
  PublicTutorProfileResponse,
  TutorTemplate,
  User,
  WorkingHours,
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
  /** Ids into the tutor's subject catalogue (users.subjects). */
  subjectIds: string[];
  /** Legacy free-text subjects from before catalogue integration. Read-time only. */
  legacySubjects: string[];
  qualifications: string[];
  hourlyRate: number | null;
  currency: string;
  location: string | null;
  teachesOnline: boolean;
  yearsExperience: number | null;
  contactEmail: string | null;
  ctaText: string | null;
  /** Denormalized from the user doc so the directory can avoid user joins. */
  name: string;
  avatarUrl: string | null;
  subjectNames: string[];
  searchText: string;
  ratingAvg: number | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

/** Public directory filters (query params of GET /directory). */
export interface DirectoryFilters {
  search?: string;
  subject?: string;
  online?: boolean;
  maxRate?: number;
  sort?: "recent" | "rating";
  limit?: number;
}

/** Cap on how many published profiles the directory scans per request. */
const DIRECTORY_SCAN_LIMIT = 200;

/** The seven weekday keys stored on WorkingHours, Monday-first. */
const WORKING_DAYS: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

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
  "tutors",
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
    subjectIds: Array.isArray(data.subjectIds) ? data.subjectIds : [],
    legacySubjects: Array.isArray(data.subjects) ? data.subjects : [],
    qualifications: data.qualifications ?? [],
    hourlyRate:
      typeof data.hourlyRate === "number" ? data.hourlyRate : null,
    currency: data.currency ?? "AUD",
    location: data.location ?? null,
    teachesOnline: data.teachesOnline === true,
    yearsExperience:
      typeof data.yearsExperience === "number" ? data.yearsExperience : null,
    contactEmail: data.contactEmail ?? null,
    ctaText: data.ctaText ?? null,
    name: data.name ?? "Tutor",
    avatarUrl: data.avatarUrl ?? null,
    subjectNames: Array.isArray(data.subjectNames) ? data.subjectNames : [],
    searchText: typeof data.searchText === "string" ? data.searchText : "",
    ratingAvg: typeof data.ratingAvg === "number" ? data.ratingAvg : null,
    reviewCount: typeof data.reviewCount === "number" ? data.reviewCount : 0,
    createdAt: data.createdAt?.toDate() ?? (null as any),
    updatedAt: data.updatedAt?.toDate() ?? (null as any),
    publishedAt: data.publishedAt ? data.publishedAt.toDate() : null,
  };
}

/**
 * Resolve a profile's showcase subjects against the tutor's catalogue.
 * Catalogue ids win; legacy free-text names are matched back into the
 * catalogue by name so old profiles adopt catalogue colors automatically.
 * Legacy names with no catalogue match survive as colorless entries so
 * nothing is silently dropped.
 */
export function resolveProfileSubjects(
  subjectIds: string[],
  legacySubjects: string[],
  catalogue: Subject[]
): Subject[] {
  const byId = new Map(catalogue.map((s) => [s.id, s]));
  const out: Subject[] = [];
  const seen = new Set<string>();

  for (const id of subjectIds) {
    const subject = byId.get(id);
    if (subject && !seen.has(subject.id)) {
      out.push(subject);
      seen.add(subject.id);
    }
  }

  for (const rawName of legacySubjects) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) continue;
    const match = catalogue.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (match) {
      if (!seen.has(match.id)) {
        out.push(match);
        seen.add(match.id);
      }
      continue;
    }
    const legacyId = `legacy:${name.toLowerCase()}`;
    if (!seen.has(legacyId)) {
      out.push({ id: legacyId, name, color: null });
      seen.add(legacyId);
    }
  }

  return out;
}

/**
 * Flatten the tutor's working hours into ordered public availability slots.
 * Null working hours or a fully-null week yields an empty array.
 */
export function buildAvailability(
  workingHours: WorkingHours | null | undefined
): AvailabilitySlot[] {
  if (!workingHours) return [];
  const slots: AvailabilitySlot[] = [];
  for (const day of WORKING_DAYS) {
    const window = workingHours[day];
    if (window && typeof window.start === "string" && typeof window.end === "string") {
      slots.push({ day, start: window.start, end: window.end });
    }
  }
  return slots;
}

/** Lowercase search blob for directory free-text matching. */
export function buildSearchText(
  name: string,
  headline: string | null,
  subjectNames: string[]
): string {
  return [name, headline ?? "", ...subjectNames]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

/** The profile fields denormalized from the user doc for directory reads. */
function identitySnapshot(user: User, subjects: Subject[]) {
  const subjectNames = subjects.map((s) => s.name);
  return {
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    subjectNames,
    searchText: buildSearchText(user.name, null, subjectNames),
  };
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

    // Currency is owned by the user document (single source of truth); the
    // profile mirrors it so the unauthenticated public page can render the
    // rate without reading the user record. The same read powers the
    // subject-catalogue validation and the directory identity snapshot.
    let currency = "AUD";
    let catalogue: Subject[] = [];
    let identity: ReturnType<typeof identitySnapshot> | null = null;
    try {
      const user = await getUserFromFirestore(tutorId);
      currency = user.currency;
      catalogue = user.subjects ?? [];
      identity = identitySnapshot(
        user,
        resolveProfileSubjects(data.subjectIds ?? [], [], catalogue)
      );
    } catch {
      // Fall back to defaults if the user record is somehow missing.
    }

    // Keep only ids that exist in the catalogue, plus carried-forward
    // legacy: names (from pre-catalogue profiles) so nothing is lost.
    const validIds = new Set(catalogue.map((s) => s.id));
    const subjectIds = (data.subjectIds ?? []).filter(
      (id) => validIds.has(id) || id.startsWith("legacy:")
    );

    // Fold the headline into the snapshot's search text now that it's known.
    const headline = data.headline ?? null;
    const snapshot = identity
      ? {
          ...identity,
          searchText: buildSearchText(
            identity.name,
            headline,
            identity.subjectNames
          ),
        }
      : null;

    const profileData: Record<string, unknown> = {
      slug: normalized,
      template: data.template ?? "classic",
      headline,
      bio: data.bio ?? null,
      subjectIds,
      // Legacy free-text list is superseded by subjectIds — clear it so
      // resolveProfileSubjects can't double-render old entries.
      subjects: [],
      qualifications: Array.isArray(data.qualifications)
        ? data.qualifications
        : [],
      hourlyRate: data.hourlyRate ?? null,
      currency,
      location: data.location ?? null,
      teachesOnline: data.teachesOnline === true,
      yearsExperience:
        typeof data.yearsExperience === "number" ? data.yearsExperience : null,
      contactEmail: data.contactEmail || null,
      ctaText: data.ctaText ?? null,
      tutorId,
      updatedAt: now,
      ...(snapshot ?? {}),
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
 * Set a profile's publication state. Publishing stamps publishedAt and
 * refreshes the denormalized identity snapshot so the directory card shows
 * the tutor's current name/avatar/subjects.
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
      const refresh = await buildIdentityRefresh(tutorId, existing);
      Object.assign(updateData, refresh);
    }
    await docRef.update(updateData);

    return getProfileByTutorId(tutorId);
  } catch (error) {
    console.error("Failed to update tutor profile status:", error);
    throw new Error("Failed to update publication status");
  }
}

/**
 * Compute a fresh identity snapshot (name, avatar, subject names, search
 * text) for a profile doc, resolving subjectIds against the live catalogue.
 * Returns an empty object when the user record can't be read.
 */
async function buildIdentityRefresh(
  tutorId: string,
  profileDoc: admin.firestore.DocumentSnapshot
): Promise<Record<string, unknown>> {
  try {
    const user = await getUserFromFirestore(tutorId);
    const data = profileDoc.data() ?? {};
    const subjects = resolveProfileSubjects(
      Array.isArray(data.subjectIds) ? data.subjectIds : [],
      Array.isArray(data.subjects) ? data.subjects : [],
      user.subjects ?? []
    );
    const identity = identitySnapshot(user, subjects);
    return {
      ...identity,
      searchText: buildSearchText(
        identity.name,
        data.headline ?? null,
        identity.subjectNames
      ),
    };
  } catch {
    return {};
  }
}

/**
 * List published profiles for the public directory. Firestore supplies the
 * recent-publish ordering; text/subject/online/rate filtering and the rating
 * sort happen in memory over the scanned window.
 */
export async function listPublicProfiles(
  filters: DirectoryFilters
): Promise<PublicTutorListResponse> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("tutorProfiles")
    .where("status", "==", "published")
    .orderBy("publishedAt", "desc")
    .limit(DIRECTORY_SCAN_LIMIT)
    .get();

  const search = filters.search?.trim().toLowerCase();
  const subject = filters.subject?.trim().toLowerCase();

  let items = snapshot.docs.map((doc) => mapDocToProfile(doc.id, doc.data()));

  if (search) {
    items = items.filter(
      (p) =>
        p.searchText.includes(search) ||
        (p.searchText === "" &&
          `${p.name} ${p.subjectNames.join(" ")}`.toLowerCase().includes(search))
    );
  }
  if (subject) {
    items = items.filter((p) =>
      p.subjectNames.some((n) => n.toLowerCase() === subject)
    );
  }
  if (filters.online === true) {
    items = items.filter((p) => p.teachesOnline);
  }
  if (typeof filters.maxRate === "number") {
    items = items.filter(
      (p) => p.hourlyRate != null && p.hourlyRate <= filters.maxRate!
    );
  }

  if (filters.sort === "rating") {
    items.sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1));
  }

  const limit = Math.min(filters.limit ?? 24, 60);
  return {
    items: items.slice(0, limit).map(toSummary),
    total: items.length,
  };
}

function toSummary(profile: TutorProfileData): PublicTutorSummary {
  return {
    slug: profile.slug,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    headline: profile.headline,
    subjects: profile.subjectNames.map((name) => ({ id: name, name, color: null })),
    hourlyRate: profile.hourlyRate,
    currency: profile.currency,
    location: profile.location,
    teachesOnline: profile.teachesOnline,
    yearsExperience: profile.yearsExperience,
    ratingAvg: profile.ratingAvg,
    reviewCount: profile.reviewCount,
    ...(profile.publishedAt
      ? { publishedAt: profile.publishedAt.toISOString() }
      : {}),
  };
}

/**
 * Build the public-facing profile payload by joining the profile content
 * with the tutor's display name, avatar, subject catalogue and working
 * hours from their user record. Returns null if no published profile
 * exists for the slug.
 */
export async function getPublicProfileBySlug(
  slug: string
): Promise<PublicTutorProfileResponse | null> {
  const profile = await getPublishedProfileBySlug(slug);
  if (!profile) return null;

  let name = "Tutor";
  let avatarUrl: string | null = null;
  let subjects: Subject[] = resolveProfileSubjects(
    profile.subjectIds,
    profile.legacySubjects,
    []
  );
  let availability: AvailabilitySlot[] = [];

  try {
    const user = await getUserFromFirestore(profile.tutorId);
    name = user.name;
    avatarUrl = user.avatarUrl ?? null;
    subjects = resolveProfileSubjects(
      profile.subjectIds,
      profile.legacySubjects,
      user.subjects ?? []
    );
    availability = buildAvailability(user.workingHours ?? null);
  } catch {
    // Fall back to a generic name if the user record is somehow missing.
  }

  return {
    slug: profile.slug,
    template: profile.template,
    headline: profile.headline,
    bio: profile.bio,
    subjects,
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
    name,
    avatarUrl,
  };
}

/**
 * Keep the profile's denormalized currency in sync with the user's currency.
 * No-op when the tutor has no profile yet. Called when the user updates their
 * currency so the public page reflects the change immediately.
 */
export async function syncTutorProfileCurrency(
  tutorId: string,
  currency: string,
): Promise<void> {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection("tutorProfiles").doc(tutorId);
  const existing = await docRef.get();
  if (!existing.exists) return;
  await docRef.update({
    currency,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Refresh the profile's denormalized identity (name, avatar, subject names,
 * search text) after the user's name, avatar or subject catalogue changes.
 * No-op when the tutor has no profile yet.
 */
export async function syncTutorProfileIdentity(tutorId: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection("tutorProfiles").doc(tutorId);
  const existing = await docRef.get();
  if (!existing.exists) return;
  const refresh = await buildIdentityRefresh(tutorId, existing);
  if (Object.keys(refresh).length === 0) return;
  await docRef.update({
    ...refresh,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Overwrite the denormalized review aggregates on a profile doc. Called by
 * the review service after moderation changes so public reads stay cheap.
 */
export async function setReviewAggregates(
  tutorId: string,
  ratingAvg: number | null,
  reviewCount: number,
): Promise<void> {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection("tutorProfiles").doc(tutorId);
  const existing = await docRef.get();
  if (!existing.exists) return;
  await docRef.update({
    ratingAvg,
    reviewCount,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}
