import { z } from "zod";

export const rateTypeSchema = z.enum(["hourly", "per_lesson"]);
export const studentStatusSchema = z.enum(["active", "past"]);

export const studentFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").trim(),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    parentEmail: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    subject: z.string().min(1, "Subject is required").trim(),
    expectedAmount: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === "string" ? Number(v) : v))
      .refine((v) => !Number.isNaN(v) && v >= 0, "Enter a valid amount"),
    rateType: rateTypeSchema,
    frequencyPerWeek: z
      .union([z.number(), z.string()])
      .transform((v) => (typeof v === "string" ? Number(v) : v))
      .refine(
        (v) => Number.isInteger(v) && v >= 0,
        "Enter a whole number (0 or more)",
      ),
    status: studentStatusSchema,
    timezoneEnabled: z.boolean(),
    timezone: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.parentEmail && data.parentEmail.length > 0) {
      const emailResult = z.string().email().safeParse(data.parentEmail);
      if (!emailResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentEmail"],
          message: "Enter a valid parent email",
        });
      }
    }
    if (data.timezoneEnabled && (!data.timezone || data.timezone.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: "Select a timezone",
      });
    }
  });

export type StudentFormData = z.infer<typeof studentFormSchema>;

export const EMPTY_STUDENT_FORM: StudentFormData = {
  name: "",
  email: "",
  phone: "",
  parentEmail: "",
  subject: "",
  expectedAmount: 0,
  rateType: "hourly",
  frequencyPerWeek: 0,
  status: "active",
  timezoneEnabled: false,
  timezone: "",
  notes: "",
};
