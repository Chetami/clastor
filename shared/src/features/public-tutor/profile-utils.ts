import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";

/**
 * Small derived values shared by every template. Centralizing these keeps the
 * layout components focused on arrangement, not boilerplate.
 */

export function getCtaLabel(profile: PublicTutorProfileResponse): string {
  return profile.ctaText?.trim() || "Get in touch";
}

/** Returns a formatted "<currency> <amount>" string, or null when no rate. */
export function formatRate(profile: PublicTutorProfileResponse): string | null {
  if (profile.hourlyRate == null) return null;
  return `${profile.currency} ${Number(profile.hourlyRate).toFixed(2)}`;
}
