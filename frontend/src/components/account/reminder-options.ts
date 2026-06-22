import type { ReminderLeadTime } from "@examify-tms/interfaces";

/** A non-null reminder lead time (the values the user can pick). */
type ReminderLeadTimeValue = Exclude<ReminderLeadTime, null>;

/** Reminder lead-time options (mirrors backend SUPPORTED_REMINDER_LEAD_TIMES). */
export const REMINDER_LEAD_TIME_OPTIONS: {
  value: ReminderLeadTimeValue;
  label: string;
}[] = [
  { value: "1_hour_before", label: "1 hour before" },
  { value: "24_hours_before", label: "24 hours before" },
  { value: "morning_of", label: "9 AM on the day" },
];

/** Sentinel for the disabled state — null means "don't notify". */
export const REMINDER_DISABLED = "__disabled__";
