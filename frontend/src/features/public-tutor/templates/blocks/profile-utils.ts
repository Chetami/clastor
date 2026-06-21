import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";

/**
 * Small derived values shared by every template. Centralizing these keeps the
 * layout components focused on arrangement, not boilerplate.
 */

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getCtaLabel(profile: PublicTutorProfileResponse): string {
  return profile.ctaText?.trim() || "Get in touch";
}

/** Returns a formatted "<currency> <amount>" string, or null when no rate. */
export function formatRate(profile: PublicTutorProfileResponse): string | null {
  if (profile.hourlyRate == null) return null;
  return `${profile.currency} ${Number(profile.hourlyRate).toFixed(2)}`;
}
