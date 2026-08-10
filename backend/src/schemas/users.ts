/**
 * Request-body Zod schema for the PATCH /api/users/me endpoint.
 * Mirrors `interfaces/src/schemas/users/req/UpdateUserRequest.yaml`.
 *
 * Field-level normalisation (timezone validity, currency allowlist, working
 * hours coercion) still happens in `userService`'s `normalize*` helpers; this
 * schema guards the structural shape + enums up front.
 */
import { z } from "zod";
import { reminderLeadTimeSchema, subjectSchema } from "./common";

const workingDayWindowSchema = z
  .object({
    start: z.string().nullish(),
    end: z.string().nullish(),
  })
  .nullish();

export const workingHoursSchema = z
  .object({
    monday: workingDayWindowSchema,
    tuesday: workingDayWindowSchema,
    wednesday: workingDayWindowSchema,
    thursday: workingDayWindowSchema,
    friday: workingDayWindowSchema,
    saturday: workingDayWindowSchema,
    sunday: workingDayWindowSchema,
  })
  .nullish();

const bankDetailsSchema = z
  .object({
    accountName: z.string().nullish(),
    bsb: z.string().nullish(),
    accountNumber: z.string().nullish(),
  })
  .nullish();

const invoiceSettingsSchema = z
  .object({
    abn: z.string().nullish(),
    bankDetails: bankDetailsSchema,
  })
  .nullish();

const emailReviewSettingsSchema = z
  .object({
    reviewEnabled: z.boolean().optional(),
  })
  .nullish();

export const updateUserSchema = z.object({
  name: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().nullish(),
  reminderLeadTime: reminderLeadTimeSchema.nullish(),
  workingHours: workingHoursSchema,
  subjects: z.array(subjectSchema).optional(),
  onboardingComplete: z.boolean().optional(),
  tourSeen: z.boolean().optional(),
  invoiceSettings: invoiceSettingsSchema,
  emailReviewSettings: emailReviewSettingsSchema,
});
