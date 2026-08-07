import { format } from "date-fns";
import type { DayOfWeek } from "@examify-tms/interfaces";
import type { EventFormData } from "../event-schema";

/** Matches a 24h `HH:mm` time string (HTML `<input type="time">`). */
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const JS_DAY_NAMES: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** "yyyy-MM-dd" — the value shape for an `<input type="date">`. */
export const toDateStr = (d: Date): string => format(d, "yyyy-MM-dd");

/** "HH:mm" — the value shape for an `<input type="time">`. */
export const toTimeStr = (d: Date): string => format(d, "HH:mm");

/** Resolve the DayOfWeek for a "yyyy-MM-dd" string, or null if invalid. */
export function weekdayOf(dateStr: string): DayOfWeek | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return JS_DAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
}

/** The browser's IANA timezone (fallback to UTC if undetectable). */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** "yyyy-12-31" — default series end (end of the chosen start year). */
export function endOfYearDateStr(dateStr: string): string {
  const year = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? Number(dateStr.slice(0, 4))
    : new Date().getFullYear();
  return `${year}-12-31`;
}

/** A blank form, ready to seed. */
export function emptyValues(): EventFormData {
  return {
    studentId: "",
    studentName: "",
    subject: "",
    date: "",
    startTime: "",
    location: "",
    notes: "",
    repeat: "none",
    slots: [],
    durationMinutes: 60,
    endsMode: "until",
    endDate: "",
    occurrenceCount: undefined,
  };
}
