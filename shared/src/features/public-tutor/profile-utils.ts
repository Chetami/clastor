import type {
  AvailabilitySlot,
  PublicTutorProfileResponse,
  WorkingHours,
} from "@examify-tms/interfaces";

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

const DAY_LABELS: Record<AvailabilitySlot["day"], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** "15:30" -> "3:30pm" (24h zero-padded input assumed). */
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

/** Formatted availability lines, or an empty array when not configured. */
export function formatAvailability(
  availability: AvailabilitySlot[] | null | undefined,
): string[] {
  if (!availability || availability.length === 0) return [];
  return availability.map(formatAvailabilitySlot);
}

const WORKING_DAY_ORDER: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Flatten working hours into ordered availability slots. */
export function workingHoursToAvailability(
  workingHours: WorkingHours | null | undefined,
): AvailabilitySlot[] {
  if (!workingHours) return [];
  const slots: AvailabilitySlot[] = [];
  for (const day of WORKING_DAY_ORDER) {
    const window = workingHours[day];
    if (window) slots.push({ day, start: window.start, end: window.end });
  }
  return slots;
}

/** Formatted availability lines straight from a WorkingHours object. */
export function formatWorkingHours(
  workingHours: WorkingHours | null | undefined,
): string[] {
  return formatAvailability(workingHoursToAvailability(workingHours));
}

/** "8 years tutoring" style label, or null when not provided. */
export function formatYearsExperience(
  years: number | null | undefined,
): string | null {
  if (years == null) return null;
  return `${years} ${years === 1 ? "year" : "years"} tutoring`;
}

/** "4.8" style average with exactly one decimal, or null when no reviews. */
export function formatRating(
  ratingAvg: number | null | undefined,
): string | null {
  if (ratingAvg == null) return null;
  return ratingAvg.toFixed(1);
}
