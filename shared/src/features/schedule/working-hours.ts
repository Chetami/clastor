import { parse, isValid } from "date-fns";
import type { WorkingHours, WorkingDayWindow } from "@examify-tms/interfaces";

/** Weekday keys, Monday-first (matches the calendar's firstDay=1). */
export const WORKING_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WorkingDay = (typeof WORKING_DAYS)[number];

export const WORKING_DAY_LABELS: Record<WorkingDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** Sensible starting point shown in Settings before the tutor saves. */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { start: "12:00", end: "20:00" },
  tuesday: { start: "12:00", end: "20:00" },
  wednesday: { start: "12:00", end: "20:00" },
  thursday: { start: "12:00", end: "20:00" },
  friday: { start: "12:00", end: "20:00" },
  saturday: null,
  sunday: null,
};

// Arbitrary reference date; only hour/minute components are read.
const TIME_REFERENCE = new Date(2000, 0, 1);

/** "HH:mm" → minutes since midnight (NaN if malformed). */
export function toMinutes(hhmm: string): number {
  // Require the canonical "HH:mm" shape; date-fns validates the ranges.
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return Number.NaN;
  const parsed = parse(hhmm, "HH:mm", TIME_REFERENCE);
  return isValid(parsed)
    ? parsed.getHours() * 60 + parsed.getMinutes()
    : Number.NaN;
}

// JS Date#getDay() index → weekday key (0 = Sunday). Self-contained so this
// module has no dependency on any calendar library's index convention.
const WEEKDAY_BY_JS_INDEX: readonly WorkingDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Find the working window for a JS Date (local time). */
export function windowForDate(
  date: Date,
  wh: WorkingHours,
): WorkingDayWindow | null {
  const day = WEEKDAY_BY_JS_INDEX[date.getDay()];
  return wh[day] ?? null;
}

/**
 * True when a [startTime, endTime] slot on `dateStr` falls outside the tutor's
 * working hours — either the day is off, or the slot extends beyond the
 * configured window. Returns false when working hours aren't configured.
 */
export function isSlotOutsideWorkingHours(
  dateStr: string,
  startTime: string,
  endTime: string,
  wh: WorkingHours | null | undefined,
): boolean {
  if (!wh) return false;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const window = windowForDate(date, wh);
  if (!window) return true; // day off

  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  const ws = toMinutes(window.start);
  const we = toMinutes(window.end);
  if ([s, e, ws, we].some(Number.isNaN)) return false;
  // Outside unless the whole slot fits within the working window.
  return s < ws || e > we;
}
