/**
 * Request-validation Zod schemas for tutor-profile + public-directory +
 * review endpoints. Mirrors interfaces/src/schemas/tutors/** YAML.
 */
import { z } from "zod";

export const tutorTemplateSchema = z.enum(["classic", "modern"]);

export const updateTutorProfileSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits and hyphens"),
  template: tutorTemplateSchema.default("classic"),
  headline: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(4000).nullish(),
  subjectIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  qualifications: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  hourlyRate: z.number().min(0).max(10000).nullish(),
  location: z.string().trim().max(80).nullish(),
  teachesOnline: z.boolean().default(false),
  yearsExperience: z.number().int().min(0).max(60).nullish(),
  contactEmail: z.string().trim().email().max(254).nullish().or(z.literal("")),
  ctaText: z.string().trim().max(40).nullish(),
});

export const listPublicTutorsQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(80).optional(),
  online: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  maxRate: z.coerce.number().min(0).max(10000).optional(),
  sort: z.enum(["recent", "rating"]).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

export const createTutorReviewSchema = z.object({
  authorName: z.string().trim().min(1, "Name is required").max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullish(),
});

export const reviewStatusSchema = z.enum(["approved", "rejected"]);
