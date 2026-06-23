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

/**
 * Map a weekday key to FullCalendar's daysOfWeek index (0 = Sunday, matching
 * JS Date#getDay()), used for the business-hours bands and day lookups.
 */
export const DAY_TO_FC_INDEX: Record<WorkingDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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
function toMinutes(hhmm: string): number {
  // Require the canonical "HH:mm" shape; date-fns validates the ranges.
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return Number.NaN;
  const parsed = parse(hhmm, "HH:mm", TIME_REFERENCE);
  return isValid(parsed)
    ? parsed.getHours() * 60 + parsed.getMinutes()
    : Number.NaN;
}

/** FullCalendar business-hours input object. */
export interface BusinessHoursInput {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

/**
 * Convert the tutor's working hours into a FullCalendar `businessHours` array
 * (one entry per enabled day). Returns `false` when working hours aren't
 * configured or no days are enabled, so the calendar renders no bands.
 */
export function workingHoursToBusinessHours(
  wh: WorkingHours | null | undefined,
): BusinessHoursInput[] | false {
  if (!wh) return false;
  const entries: BusinessHoursInput[] = [];
  for (const day of WORKING_DAYS) {
    const window = wh[day];
    if (!window) continue;
    entries.push({
      daysOfWeek: [DAY_TO_FC_INDEX[day]],
      startTime: window.start,
      endTime: window.end,
    });
  }
  console.log(entries);
  return entries.length > 0 ? entries : false;
}

/** Find the working window for a JS Date (local time). */
function windowForDate(date: Date, wh: WorkingHours): WorkingDayWindow | null {
  const fcIndex = date.getDay(); // 0 = Sunday — matches DAY_TO_FC_INDEX
  const day = WORKING_DAYS.find((d) => DAY_TO_FC_INDEX[d] === fcIndex);
  if (!day) return null;
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
