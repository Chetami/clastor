import { z } from "zod";

export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "stripe"]);

export const rateTypeSchema = z.enum(["hourly", "per_lesson"]);

export const lineItemSchema = z.object({
  lessonId: z.string().min(1),
  description: z.string(),
  durationMinutes: z.number().int().min(1),
  rateType: rateTypeSchema,
  unitAmount: z.number().min(0),
  quantity: z.number().min(0),
});

export const createInvoiceFormSchema = z
  .object({
    studentId: z.string().min(1, "Select a student"),
    lineItems: z.array(lineItemSchema).min(1, "Select at least one lesson"),
    billingEmail: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || z.string().email().safeParse(v).success,
        "Enter a valid billing email",
      ),
    dueDate: z.string().min(1, "Due date is required"),
    paymentMethod: paymentMethodSchema,
    notes: z.string().trim().optional().or(z.literal("")),
    status: z.enum(["draft", "open"]).default("draft"),
  })
  .superRefine((data, ctx) => {
    // Validate each line item has a positive amount
    data.lineItems.forEach((li, idx) => {
      const amount = li.unitAmount * li.quantity;
      if (amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lineItems", idx, "unitAmount"],
          message: "Amount must be greater than 0",
        });
      }
    });
  });

export type CreateInvoiceFormData = z.infer<typeof createInvoiceFormSchema>;

/**
 * Compute the default unit amount for a lesson based on the student's
 * expected amount. For both hourly and per_lesson rate types the
 * expectedAmount IS the per-unit rate (hourly rate / per-lesson rate).
 * The billable quantity is computed separately in defaultQuantity().
 */
export function defaultUnitAmount(expectedAmount: number): number {
  return expectedAmount;
}

/**
 * Compute the quantity (billable units) for a line item:
 * - hourly: hours (durationMinutes / 60)
 * - per_lesson: 1
 */
export function defaultQuantity(
  rateType: "hourly" | "per_lesson",
  durationMinutes: number,
): number {
  if (rateType === "hourly") {
    return Math.round((durationMinutes / 60) * 100) / 100;
  }
  return 1;
}
