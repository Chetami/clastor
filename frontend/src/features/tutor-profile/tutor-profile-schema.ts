import { z } from "zod";
import {
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_IDS,
  TEMPLATES,
  type TemplateId,
} from "@/features/public-tutor/templates/registry";

export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

/**
 * The selectable templates are derived from the registry — see
 * `public-tutor/templates/registry.ts`. No template ids or labels are
 * duplicated here.
 */
export const TEMPLATE_OPTIONS: { value: TemplateId; label: string }[] =
  TEMPLATE_IDS.map((value) => ({ value, label: TEMPLATES[value].label }));

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
  template: z.enum(TEMPLATE_IDS as [TemplateId, ...TemplateId[]]),
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
  template: DEFAULT_TEMPLATE_ID,
  headline: "",
  bio: "",
  subjects: [],
  qualifications: [],
  hourlyRate: null,
  contactEmail: "",
  ctaText: "",
};
