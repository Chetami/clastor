/**
 * Request-body Zod schemas for payment (invoice) endpoints.
 * Mirrors `interfaces/src/schemas/payments/req/*.yaml`.
 */
import { z } from "zod";
import {
  invoiceStatusSchema,
  paymentMethodSchema,
  rateTypeSchema,
  schemaUtils,
} from "./common";

/** A chargeable line item on an invoice (request shape — no server `amount`). */
const invoiceLineItemSchema = z.object({
  lessonId: z.string().min(1),
  description: z.string(),
  durationMinutes: z.number().int().min(1),
  rateType: rateTypeSchema,
  unitAmount: z.number().min(0),
  quantity: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
  billingEmail: z.string().email("Enter a valid email").nullish(),
  dueDate: schemaUtils.isoDateTime,
  paymentMethod: paymentMethodSchema,
  issueDate: schemaUtils.isoDateTime.nullish(),
  status: invoiceStatusSchema.optional(),
  notes: z.string().nullish(),
});

export const updateInvoiceSchema = z.object({
  dueDate: schemaUtils.isoDateTime.nullish(),
  paymentMethod: paymentMethodSchema.optional(),
  status: invoiceStatusSchema.optional(),
  notes: z.string().nullish(),
  lineItems: z.array(invoiceLineItemSchema).nullish(),
});

export const markPaidSchema = z.object({
  paymentMethod: paymentMethodSchema.optional(),
  paidAt: schemaUtils.isoDateTime.nullish(),
});

/** Invoice send / preview endpoints accept an optional custom message. */
export const invoiceMessageSchema = z.object({
  message: z.string().nullish(),
});
