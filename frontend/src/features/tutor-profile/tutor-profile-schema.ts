import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

export const tutorProfileFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(40, "Slug must be 40 characters or fewer")
    .regex(
      SLUG_PATTERN,
      "Use lowercase letters, digits and hyphens only",
    ),
  headline: z.string().trim().optional().or(z.literal("")),
  bio: z.string().trim().optional().or(z.literal("")),
  subjectIds: z.array(z.string()),
  qualifications: z.array(z.string()),
  hourlyRate: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (!Number.isNaN(v) && v >= 0),
      "Enter a valid amount",
    ),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  teachesOnline: z.boolean(),
  yearsExperience: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 60),
      "Enter 0–60 years",
    ),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "Enter a valid email",
    ),
  ctaText: z.string().trim().optional().or(z.literal("")),
});

export type TutorProfileFormData = z.infer<typeof tutorProfileFormSchema>;

export const EMPTY_TUTOR_PROFILE_FORM: TutorProfileFormData = {
  slug: "",
  headline: "",
  bio: "",
  subjectIds: [],
  qualifications: [],
  hourlyRate: null,
  location: "",
  teachesOnline: false,
  yearsExperience: null,
  contactEmail: "",
  ctaText: "",
};
