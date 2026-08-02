import type { WorkingHours } from "@examify-tms/interfaces";
import { WORKING_DAYS, type WorkingDay } from "@examify-tms/shared";

// Pure working-hours logic (weekday keys, defaults, out-of-hours predicate)
// lives in @examify-tms/shared — re-exported here for existing imports.
export {
  WORKING_DAYS,
  WORKING_DAY_LABELS,
  DEFAULT_WORKING_HOURS,
  toMinutes,
  windowForDate,
  isSlotOutsideWorkingHours,
  type WorkingDay,
} from "@examify-tms/shared";

// --- FullCalendar-specific helpers stay in the web client ---

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
  return entries.length > 0 ? entries : false;
}
