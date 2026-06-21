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
  template: z.enum(["classic"]),
  headline: z.string().trim().optional().or(z.literal("")),
  bio: z.string().trim().optional().or(z.literal("")),
  subjects: z.array(z.string()),
  qualifications: z.array(z.string()),
  hourlyRate: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (!Number.isNaN(v) && v >= 0),
      "Enter a valid amount",
    ),
  currency: z.string().trim().min(1, "Currency is required").default("USD"),
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
  template: "classic",
  headline: "",
  bio: "",
  subjects: [],
  qualifications: [],
  hourlyRate: null,
  currency: "USD",
  contactEmail: "",
  ctaText: "",
};
