import type {
  AvailabilitySlot,
  PublicTutorProfileResponse,
} from "@examify-tms/interfaces";

/**
 * Display helpers for the public tutor pages.
 *
 * These intentionally duplicate the small formatters in
 * @examify-tms/shared — the website stays decoupled from the shared data
 * layer (which pulls axios, zustand and react-query). Keep the output in
 * sync with shared/src/features/public-tutor/profile-utils.ts.
 */

export function getCtaLabel(profile: PublicTutorProfileResponse): string {
  return profile.ctaText?.trim() || "Get in touch";
}

export function formatRate(profile: PublicTutorProfileResponse): string | null {
  if (profile.hourlyRate == null) return null;
  return `${profile.currency} ${Number(profile.hourlyRate).toFixed(2)}`;
}

const DAY_LABELS: Record<AvailabilitySlot["day"], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** "15:30" -> "3:30pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

/** "monday 15:30-20:00" -> "Mon · 3:30pm – 8:00pm" */
export function formatAvailabilitySlot(slot: AvailabilitySlot): string {
  return `${DAY_LABELS[slot.day]} · ${formatTime(slot.start)} – ${formatTime(slot.end)}`;
}

export function formatYearsExperience(
  years: number | null | undefined,
): string | null {
  if (years == null) return null;
  return `${years} ${years === 1 ? "year" : "years"} tutoring`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
