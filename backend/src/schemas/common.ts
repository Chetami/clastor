/**
 * Canonical Zod enums for the backend.
 *
 * These mirror the enum values defined in the OpenAPI YAML under
 * interfaces/src/schemas so runtime validation and the generated types
 * agree. The backend cannot import @examify-tms/shared (client-only deps),
 * so the request-validation schemas live here. Keep the literal values in
 * sync with the YAML when an enum changes.
 */
import { z } from "zod";

// students/
export const rateTypeSchema = z.enum(["hourly", "per_lesson"]);
export const studentStatusSchema = z.enum(["active", "past"]);

// payments/
export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "stripe"]);
export const invoiceStatusSchema = z.enum([
  "draft",
  "open",
  "paid",
  "overdue",
  "void",
]);

// lessons/
export const dayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
export const lessonAcceptanceSchema = z.enum(["pending", "accepted", "declined"]);
export const attendanceStatusSchema = z.enum([
  "unrecorded",
  "present",
  "present_late",
  "absent_no_makeup",
  "absent_makeup_issued",
  "absent_warning",
  "tutor_cancelled",
  "tutor_cancelled_makeup_issued",
]);

// feedback/
export const feedbackTypeSchema = z.enum(["bug", "feedback", "feature_request"]);

// users (preferences)
export const reminderLeadTimeSchema = z.enum([
  "1_hour_before",
  "24_hours_before",
  "morning_of",
]);

/** A recurring-series weekly slot. */
export const lessonSlotSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, "timeOfDay must be HH:mm"),
});

/** A checklist item attached to a lesson. */
export const lessonTodoSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  done: z.boolean(),
});

/** A subject in the tutor's catalogue. */
export const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().nullish(),
});

/** An ISO date-time string (validated by `new Date()` finiteness). */
const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Must be a valid ISO date-time");

/** An ISO date (YYYY-MM-DD) string. */
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Must be a valid date");

export const schemaUtils = { isoDateTime, isoDate };
