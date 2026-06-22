import type { UserInfo, PublicTutorProfileResponse, TutorProfileResponse } from "@examify-tms/interfaces";
import { DEFAULT_TEMPLATE_ID } from "@/features/public-tutor/templates/registry";
import { EMPTY_TUTOR_PROFILE_FORM, type TutorProfileFormData } from "./tutor-profile-schema";

function clean(arr: string[]): string[] {
  return arr.map((s) => s.trim()).filter((s) => s.length > 0);
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
    subjects: clean(values.subjects),
    qualifications: clean(values.qualifications),
    hourlyRate: values.hourlyRate,
    currency: user?.currency ?? "AUD",
    contactEmail: values.contactEmail?.trim() || null,
    ctaText: values.ctaText?.trim() || null,
    name: user?.name ?? "Your name",
    avatarUrl: user?.avatarUrl ?? null,
  };
}

/**
 * Convert a saved TutorProfileResponse (or null) into editor form values.
 * null (no profile yet) yields the empty form.
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
    subjects: profile.subjects ?? [],
    qualifications: profile.qualifications ?? [],
    hourlyRate: profile.hourlyRate ?? null,
    contactEmail: profile.contactEmail ?? "",
    ctaText: profile.ctaText ?? "",
  };
}
