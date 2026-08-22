import type {
  AvailabilitySlot,
  Subject,
  UserInfo,
  PublicTutorProfileResponse,
  TutorProfileResponse,
  WorkingHours,
} from "@examify-tms/interfaces";
import { DEFAULT_TEMPLATE_ID } from "@/features/public-tutor/templates/registry";
import { EMPTY_TUTOR_PROFILE_FORM, type TutorProfileFormData } from "./tutor-profile-schema";

function clean(arr: string[]): string[] {
  return arr.map((s) => s.trim()).filter((s) => s.length > 0);
}

const WORKING_DAYS: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function buildAvailability(
  workingHours: WorkingHours | null | undefined,
): AvailabilitySlot[] {
  if (!workingHours) return [];
  const slots: AvailabilitySlot[] = [];
  for (const day of WORKING_DAYS) {
    const window = workingHours[day];
    if (window) slots.push({ day, start: window.start, end: window.end });
  }
  return slots;
}

/** Resolve the tutor's catalogue ids to full Subject objects. */
export function resolveSubjects(
  subjectIds: string[],
  catalogue: Subject[] | undefined,
): Subject[] {
  const byId = new Map((catalogue ?? []).map((s) => [s.id, s]));
  return subjectIds
    .map((id) => byId.get(id))
    .filter((s): s is Subject => !!s);
}

/**
 * Build a PublicTutorProfileResponse from the live editor state + the
 * logged-in user's name/avatar, so the real public template can render a
 * faithful preview without anything being published.
 */
export function buildPreviewProfile(
  values: TutorProfileFormData,
  user: UserInfo | null | undefined,
): PublicTutorProfileResponse {
  return {
    slug: values.slug.trim().toLowerCase() || "your-slug",
    template: values.template,
    headline: values.headline?.trim() || null,
    bio: values.bio?.trim() || null,
    subjects: resolveSubjects(values.subjectIds, user?.subjects),
    qualifications: clean(values.qualifications),
    hourlyRate: values.hourlyRate,
    currency: user?.currency ?? "AUD",
    location: values.location?.trim() || null,
    teachesOnline: values.teachesOnline,
    yearsExperience: values.yearsExperience,
    contactEmail: values.contactEmail?.trim() || null,
    ctaText: values.ctaText?.trim() || null,
    availability: buildAvailability(user?.workingHours ?? null),
    ratingAvg: null,
    reviewCount: 0,
    name: user?.name ?? "Your name",
    avatarUrl: user?.avatarUrl ?? null,
  };
}

/**
 * Convert a saved TutorProfileResponse (or null) into editor form values.
 * null (no profile yet) yields the empty form. The response's resolved
 * subjects are folded back into ids (legacy name-only entries keep their
 * `legacy:` ids so they survive a round-trip).
 */
export function profileResponseToValues(
  profile: TutorProfileResponse | null | undefined,
): TutorProfileFormData {
  if (!profile) return { ...EMPTY_TUTOR_PROFILE_FORM };
  return {
    slug: profile.slug ?? "",
    template: profile.template ?? DEFAULT_TEMPLATE_ID,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    subjectIds: (profile.subjects ?? []).map((s) => s.id),
    qualifications: profile.qualifications ?? [],
    hourlyRate: profile.hourlyRate ?? null,
    location: profile.location ?? "",
    teachesOnline: profile.teachesOnline ?? false,
    yearsExperience: profile.yearsExperience ?? null,
    contactEmail: profile.contactEmail ?? "",
    ctaText: profile.ctaText ?? "",
  };
}
