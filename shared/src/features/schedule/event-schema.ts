import { z } from "zod";
import type {
  CreateLessonRequest,
  CreateRecurringLessonRequest,
  DayOfWeek,
} from "@examify-tms/interfaces";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};
export const DAY_FULL_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** Common lesson durations surfaced as quick picks in the UI. */
export const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;

const repeatEnum = z.enum(["none", "weekly", "biweekly", "monthly"]);
export type Repeat = z.infer<typeof repeatEnum>;

/**
 * A single weekly lesson within a recurring series, expressed as one
 * self-contained day-of-week + start-time pair (mirrors the backend
 * `LessonSlot`). Keeping day and time together — instead of splitting them
 * across separate "selected days" and "per-day times" sections — matches how a
 * tutor actually thinks about a slot.
 */
export interface RecurringSlot {
  dayOfWeek: DayOfWeek;
  timeOfDay: string; // HH:mm
}

export function minutesBetween(start: string, end: string): number {
  const [, sh, sm] = start.match(timeRegex)!.map(Number);
  const [, eh, em] = end.match(timeRegex)!.map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

const slotSchema = z.object({
  dayOfWeek: z.enum(DAYS),
  timeOfDay: z.string().regex(timeRegex, "Enter a valid time"),
});

export const eventFormSchema = z
  .object({
    studentId: z.string().min(1, "Select a student"),
    studentName: z.string().min(1),
    subject: z.string().trim().optional().or(z.literal("")),
    date: z.string().regex(dateRegex, "Enter a valid date"),
    // One-off lessons need a start time; the per-lesson duration comes from the
    // shared `durationMinutes` field (same picker as a recurring series). For a
    // recurring series each slot carries its own time, so this is just a seed.
    startTime: z.string().optional().or(z.literal("")),
    location: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
    repeat: repeatEnum.default("none"),
    // Recurring: each weekly lesson as a self-contained day+time row.
    slots: z.array(slotSchema).default([]),
    // Per-lesson duration shared by one-off and recurring (explicit, decoupled
    // from any clock-time window).
    durationMinutes: z.coerce.number().int().min(1, "Enter a duration").default(60),
    endsMode: z.enum(["until", "count"]).default("until"),
    endDate: z.string().optional().or(z.literal("")),
    occurrenceCount: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.repeat === "none") {
      // One-off: a concrete start time + duration are required.
      if (!data.startTime || !timeRegex.test(data.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startTime"],
          message: "Enter a valid start time",
        });
      }
      if (!data.durationMinutes || data.durationMinutes < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationMinutes"],
          message: "Enter a duration",
        });
      }
    } else {
      // Recurring: slots + explicit duration + end bound are required.
      if (data.slots.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots"],
          message: "Add at least one lesson time",
        });
      }
      if (data.endsMode === "until") {
        if (!data.endDate || !dateRegex.test(data.endDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endDate"],
            message: "Choose an end date",
          });
        }
      } else if (!data.occurrenceCount || data.occurrenceCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["occurrenceCount"],
          message: "Enter the number of lessons",
        });
      }
    }
  });

export type EventFormData = z.infer<typeof eventFormSchema>;

/** Convert form values to the API CreateLessonRequest shape (one-off). */
export function toCreateLessonRequest(
  values: EventFormData,
): CreateLessonRequest {
  // `startTime` + `durationMinutes` are validated for one-off lessons — see
  // eventFormSchema — so they are guaranteed present/valid here.
  const startTime = values.startTime!;
  return {
    studentId: values.studentId,
    subject: values.subject ? values.subject : null,
    startDateTime: new Date(`${values.date}T${startTime}:00`).toISOString(),
    durationMinutes: values.durationMinutes,
    location: values.location ? values.location : null,
    notes: values.notes ? values.notes : null,
    remindersEnabled: true,
  };
}

/** Map a human cadence ("weekly"/"biweekly"/"monthly") to a week interval. */
export function intervalWeeksFor(repeat: Repeat): number {
  return repeat === "biweekly" ? 2 : repeat === "monthly" ? 4 : 1;
}

/** Convert form values to the API CreateRecurringLessonRequest shape. */
export function toCreateRecurringLessonRequest(
  values: EventFormData,
  timezone: string,
): CreateRecurringLessonRequest {
  return {
    studentId: values.studentId,
    subject: values.subject ? values.subject : null,
    durationMinutes: values.durationMinutes,
    intervalWeeks: intervalWeeksFor(values.repeat),
    slots: values.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek as DayOfWeek,
      timeOfDay: s.timeOfDay,
    })),
    timezone,
    startDate: values.date,
    until: values.endsMode === "until" && values.endDate ? values.endDate : null,
    count:
      values.endsMode === "count" && values.occurrenceCount
        ? values.occurrenceCount
        : null,
    location: values.location ? values.location : null,
    notes: values.notes ? values.notes : null,
    remindersEnabled: true,
  };
}

/**
 * Rough preview of how many lessons a recurring series will create, mirroring
 * the backend's week-stepping loosely. Returns null when it can't be computed.
 */
export function estimateOccurrenceCount(
  values: Pick<
    EventFormData,
    "repeat" | "slots" | "endsMode" | "date" | "endDate" | "occurrenceCount"
  >,
): number | null {
  if (values.repeat === "none" || values.slots.length === 0) return null;
  if (values.endsMode === "count") return values.occurrenceCount ?? null;
  if (!values.date || !values.endDate) return null;
  const startMs = new Date(`${values.date}T00:00:00`).getTime();
  const endMs = new Date(`${values.endDate}T00:00:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }
  const intervalWeeks = intervalWeeksFor(values.repeat);
  const weeks = Math.floor((endMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const onWeeks = Math.ceil(weeks / intervalWeeks);
  return Math.max(0, onWeeks * values.slots.length);
}

const CADENCE_LABEL: Record<Repeat, string> = {
  none: "",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every 4 weeks",
};

/** Format an "HH:mm" time as a friendly "h:mm AM/PM" string. */
export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function dayOrder(day: string): number {
  return DAYS.indexOf(day as (typeof DAYS)[number]);
}

/**
 * Build a plain-English summary of the recurring series so the user can verify
 * exactly what they're about to create before submitting. Empty when the form
 * isn't a complete recurring series yet.
 *
 * e.g. "Every week on Monday 4:00 PM & Wednesday 5:00 PM, 60 min each, until
 * Dec 31, 2026 · about 52 lessons"
 */
export function describeRecurrence(values: EventFormData): string {
  if (values.repeat === "none" || values.slots.length === 0) return "";

  const cadence = CADENCE_LABEL[values.repeat];
  const sorted = [...values.slots].sort(
    (a, b) => dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek),
  );
  const labels = sorted.map(
    (s) =>
      `${DAY_FULL_LABELS[s.dayOfWeek as (typeof DAYS)[number]]} ${formatTime12h(
        s.timeOfDay,
      )}`,
  );
  const slotText =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;

  let end = "";
  if (values.endsMode === "until" && values.endDate) {
    const d = new Date(`${values.endDate}T00:00:00`);
    end = `until ${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  } else if (values.endsMode === "count" && values.occurrenceCount) {
    end = `for ${values.occurrenceCount} lessons`;
  }

  const count = estimateOccurrenceCount(values);
  const approx = count ? ` · about ${count} lessons` : "";

  return `${cadence} on ${slotText}, ${values.durationMinutes} min each${
    end ? `, ${end}` : ""
  }${approx}`;
}

/** Add a number of minutes to an "HH:mm" time, wrapping at midnight. */
export function timePlusMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/**
 * Build a plain-English summary of a one-off lesson (start time + derived end)
 * so the user can verify exactly what they're about to create before
 * submitting. Empty for a recurring series or an incomplete one-off.
 *
 * e.g. "Thursday, 15 Jan 2026 · 4:00 PM – 5:00 PM (60 min)"
 */
export function describeOneOff(values: EventFormData): string {
  if (values.repeat !== "none") return "";
  if (!values.date || !values.startTime) return "";
  if (!timeRegex.test(values.startTime)) return "";
  if (!values.durationMinutes || values.durationMinutes < 1) return "";

  const start = new Date(`${values.date}T${values.startTime}:00`);
  if (Number.isNaN(start.getTime())) return "";
  const endTime = timePlusMinutes(values.startTime, values.durationMinutes);

  const weekday = start.toLocaleDateString(undefined, { weekday: "long" });
  const datePart = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${weekday}, ${datePart} · ${formatTime12h(
    values.startTime,
  )} – ${formatTime12h(endTime)} (${values.durationMinutes} min)`;
}
