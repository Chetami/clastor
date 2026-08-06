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

const repeatEnum = z.enum(["none", "weekly", "biweekly", "monthly"]);
export type Repeat = z.infer<typeof repeatEnum>;

export function minutesBetween(start: string, end: string): number {
  const [, sh, sm] = start.match(timeRegex)!.map(Number);
  const [, eh, em] = end.match(timeRegex)!.map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export const eventFormSchema = z
  .object({
    studentId: z.string().min(1, "Select a student"),
    studentName: z.string().min(1),
    subject: z.string().trim().optional().or(z.literal("")),
    date: z.string().regex(dateRegex, "Enter a valid date"),
    startTime: z.string().regex(timeRegex, "Enter a valid start time"),
    endTime: z.string().regex(timeRegex, "Enter a valid end time"),
    location: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
    repeat: repeatEnum.default("none"),
    selectedDays: z.array(z.enum(DAYS)).default([]),
    slotTimes: z.record(z.string(), z.string()).default({}),
    endsMode: z.enum(["until", "count"]).default("until"),
    endDate: z.string().optional().or(z.literal("")),
    occurrenceCount: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
    if (data.repeat !== "none") {
      if (data.selectedDays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedDays"],
          message: "Pick at least one day",
        });
      }
      for (const day of data.selectedDays) {
        const t = data.slotTimes[day];
        if (!t || !timeRegex.test(t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slotTimes"],
            message: `Set a valid time for ${day}`,
          });
        }
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
  return {
    studentId: values.studentId,
    subject: values.subject ? values.subject : null,
    startDateTime: new Date(
      `${values.date}T${values.startTime}:00`,
    ).toISOString(),
    durationMinutes: minutesBetween(values.startTime, values.endTime),
    location: values.location ? values.location : null,
    notes: values.notes ? values.notes : null,
    remindersEnabled: true,
  };
}

/** Convert form values to the API CreateRecurringLessonRequest shape. */
export function toCreateRecurringLessonRequest(
  values: EventFormData,
  timezone: string,
): CreateRecurringLessonRequest {
  const durationMinutes = minutesBetween(values.startTime, values.endTime);
  const slots = values.selectedDays.map((day) => ({
    dayOfWeek: day as DayOfWeek,
    timeOfDay: values.slotTimes[day] ?? values.startTime,
  }));
  const intervalWeeks =
    values.repeat === "weekly"
      ? 1
      : values.repeat === "biweekly"
        ? 2
        : values.repeat === "monthly"
          ? 4
          : 1;
  return {
    studentId: values.studentId,
    subject: values.subject ? values.subject : null,
    durationMinutes,
    intervalWeeks,
    slots,
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
