/**
 * Request-body Zod schemas for lesson + lesson-series endpoints.
 * Mirrors `interfaces/src/schemas/lessons/req/*.yaml`.
 */
import { z } from "zod";
import {
  attendanceStatusSchema,
  lessonAcceptanceSchema,
  lessonSlotSchema,
  lessonTodoSchema,
  schemaUtils,
} from "./common";

export const createLessonSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  subject: z.string().nullish(),
  startDateTime: schemaUtils.isoDateTime,
  durationMinutes: z.number().int().min(1),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  remindersEnabled: z.boolean().default(true),
});

export const updateLessonSchema = z.object({
  studentId: z.string().nullish(),
  subject: z.string().nullish(),
  startDateTime: schemaUtils.isoDateTime.nullish(),
  durationMinutes: z.number().int().min(1).nullish(),
  location: z.string().nullish(),
  meetLink: z.string().nullish(),
  notes: z.string().nullish(),
  todos: z.array(lessonTodoSchema).nullish(),
  acceptanceStatus: lessonAcceptanceSchema.optional(),
  remindersEnabled: z.boolean().nullish(),
  isPaid: z.boolean().nullish(),
});

export const rescheduleLessonSchema = z
  .object({
    startDateTime: schemaUtils.isoDateTime,
    durationMinutes: z.number().int().min(1).nullish(),
    notifyStudent: z.boolean().optional(),
    message: z.string().nullish(),
    scope: z.enum(["this", "this_and_future"]).optional(),
  })
  .refine(
    (data) => data.startDateTime !== undefined,
    { message: "startDateTime is required", path: ["startDateTime"] },
  );

export const recordAttendanceSchema = z.object({
  attendanceStatus: attendanceStatusSchema,
});

export const cancelLessonSchema = z.object({
  notifyStudent: z.boolean().optional(),
  message: z.string().nullish(),
  scope: z.enum(["this", "this_and_future"]).optional(),
});

export const notifyStudentSchema = z.object({
  message: z.string().nullish(),
});

export const createRecurringLessonSchema = z
  .object({
    studentId: z.string().min(1, "studentId is required"),
    subject: z.string().nullish(),
    durationMinutes: z.number().int().min(1),
    location: z.string().nullish(),
    notes: z.string().nullish(),
    intervalWeeks: z.number().int().min(1),
    slots: z.array(lessonSlotSchema).min(1, "At least one slot is required").max(7),
    timezone: z.string().min(1, "timezone is required"),
    startDate: schemaUtils.isoDate,
    until: schemaUtils.isoDate.nullish(),
    count: z.number().int().min(1).nullish(),
    remindersEnabled: z.boolean().default(true),
  })
  .refine(
    (data) => {
      const hasUntil = data.until !== undefined && data.until !== null;
      const hasCount = data.count !== undefined && data.count !== null;
      return hasUntil !== hasCount; // exactly one
    },
    { message: "Exactly one of 'until' or 'count' must be provided" },
  );

export const updateLessonSeriesSchema = z.object({
  subject: z.string().nullish(),
  durationMinutes: z.number().int().min(1).nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  remindersEnabled: z.boolean().nullish(),
  acceptanceStatus: lessonAcceptanceSchema.optional(),
  intervalWeeks: z.number().int().min(1).nullish(),
  slots: z.array(lessonSlotSchema).min(1).max(7).nullish(),
  timezone: z.string().nullish(),
  until: schemaUtils.isoDate.nullish(),
  count: z.number().int().min(1).nullish(),
});

/** Preview endpoints only accept an optional custom message body. */
export const messageBodySchema = z.object({
  message: z.string().nullish(),
});

/** Reschedule preview body (optional new time + message). */
export const reschedulePreviewSchema = z.object({
  startDateTime: schemaUtils.isoDateTime.optional(),
  durationMinutes: z.number().int().min(1).nullish(),
  scope: z.enum(["this", "this_and_future"]).optional(),
  message: z.string().nullish(),
});

/** Cancel preview body (optional scope + message). */
export const cancelPreviewSchema = z.object({
  scope: z.enum(["this", "this_and_future"]).optional(),
  message: z.string().nullish(),
});
