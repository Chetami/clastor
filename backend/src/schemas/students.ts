/**
 * Request-body Zod schemas for student endpoints.
 * Mirrors `interfaces/src/schemas/students/req/*.yaml`.
 */
import { z } from "zod";
import { rateTypeSchema, studentStatusSchema } from "./common";

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Enter a valid email").nullish(),
  phone: z.string().nullish(),
  parentEmail: z.string().email("Enter a valid email").nullish(),
  billingEmail: z.string().email("Enter a valid email").nullish(),
  subjectIds: z.array(z.string()).default([]),
  expectedAmount: z.number().min(0),
  rateType: rateTypeSchema,
  frequencyPerWeek: z.number().int().min(0),
  status: studentStatusSchema.default("active"),
  timezone: z.string().nullish(),
  notes: z.string().nullish(),
});

export const updateStudentSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  // Matches the OpenAPI contract: `email: null` clears an existing email.
  email: z.string().email("Enter a valid email").nullish(),
  phone: z.string().nullish(),
  parentEmail: z.string().email("Enter a valid email").nullish(),
  billingEmail: z.string().email("Enter a valid email").nullish(),
  subjectIds: z.array(z.string()).optional(),
  expectedAmount: z.number().min(0).optional(),
  rateType: rateTypeSchema.optional(),
  frequencyPerWeek: z.number().int().min(0).optional(),
  status: studentStatusSchema.optional(),
  timezone: z.string().nullish(),
  notes: z.string().nullish(),
});
