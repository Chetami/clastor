import { z } from "zod";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import type {
  CreateStudentRequest,
  UpdateStudentRequest,
} from "@examify-tms/interfaces";
// `rateTypeSchema` is shared with the payments module (identical enum); import
// the canonical definition instead of redefining it here.
import { rateTypeSchema } from "../payments/invoice-schema";

export const studentStatusSchema = z.enum(["active", "past"]);

export const studentFormSchema = z
  .object({
    // trim before min so a whitespace-only name is rejected, not trimmed
    // to "" after passing validation
    name: z.string().trim().min(1, "Name is required"),
    email: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || isPossiblePhoneNumber(v),
        "Enter a valid phone number",
      ),
    parentEmail: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    billingEmailMode: z.enum(["auto", "custom"]),
    billingEmail: z.string().trim().optional().or(z.literal("")),
    subjectIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one subject"),
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
    if (data.email && data.email.length > 0) {
      const emailResult = z.string().email().safeParse(data.email);
      if (!emailResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Enter a valid email",
        });
      }
    }
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
    if (
      data.billingEmailMode === "custom" &&
      data.billingEmail &&
      data.billingEmail.length > 0
    ) {
      const emailResult = z.string().email().safeParse(data.billingEmail);
      if (!emailResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billingEmail"],
          message: "Enter a valid billing email",
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
  billingEmailMode: "auto",
  billingEmail: "",
  subjectIds: [],
  expectedAmount: 0,
  rateType: "hourly",
  frequencyPerWeek: 0,
  status: "active",
  timezoneEnabled: false,
  timezone: "",
  notes: "",
};

/** Map the validated form to a create-student request payload. */
export function formToCreateRequest(
  data: StudentFormData,
): CreateStudentRequest {
  return {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    parentEmail: data.parentEmail || null,
    billingEmail:
      data.billingEmailMode === "auto"
        ? null
        : (data.billingEmail?.trim() || null),
    subjectIds: data.subjectIds,
    expectedAmount: data.expectedAmount,
    rateType: data.rateType,
    frequencyPerWeek: data.frequencyPerWeek,
    status: data.status,
    timezone: data.timezoneEnabled ? (data.timezone || null) : null,
    notes: data.notes || null,
  };
}

export function formToUpdateRequest(data: StudentFormData): UpdateStudentRequest {
  return {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    parentEmail: data.parentEmail || null,
    billingEmail:
      data.billingEmailMode === "auto"
        ? null
        : (data.billingEmail?.trim() || null),
    subjectIds: data.subjectIds,
    expectedAmount: data.expectedAmount,
    rateType: data.rateType,
    frequencyPerWeek: data.frequencyPerWeek,
    status: data.status,
    timezone: data.timezoneEnabled ? data.timezone : null,
    notes: data.notes || null,
  };
}
