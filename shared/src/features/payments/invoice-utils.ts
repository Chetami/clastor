import type {
  InvoiceResponse,
  LessonResponse,
  PaymentMethod,
  RateType,
} from "@examify-tms/interfaces";
import { defaultQuantity, defaultUnitAmount } from "./invoice-schema";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  stripe: "Stripe",
};

export function formatCurrency(
  amount: number,
  currency: string = "AUD",
): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactCurrency(
  amount: number,
  currency: string = "AUD",
): string {
  return amount % 1 === 0
    ? formatCurrency(amount, currency).replace(/\.00$/, "")
    : formatCurrency(amount, currency);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isOverdue(invoice: InvoiceResponse): boolean {
  return (
    (invoice.status === "open" || invoice.status === "overdue") &&
    new Date(invoice.dueDate).getTime() < Date.now()
  );
}

/**
 * A line item draft for a single lesson, ready to post to the create-invoice
 * endpoint. This is the canonical shape every invoicing entry point builds
 * from so descriptions/amounts can't drift between surfaces.
 */
export interface LessonLineItemDraft {
  lessonId: string;
  description: string;
  durationMinutes: number;
  rateType: RateType;
  unitAmount: number;
  quantity: number;
}

/**
 * Build the human-readable description for a lesson line item.
 * Format: "{subject} — {duration} min on {date}" (matches the invoice page).
 */
export function buildLessonDescription(lesson: LessonResponse): string {
  return `${lesson.subject || "Lesson"} — ${lesson.durationMinutes} min on ${formatDate(
    lesson.startDateTime,
  )}`;
}

/**
 * Build a complete line item draft from a lesson + the student's rate.
 * Uses defaultUnitAmount / defaultQuantity so behaviour matches the
 * Create Invoice page exactly.
 */
export function buildLessonLineItem(
  lesson: LessonResponse,
  rateType: RateType,
  expectedAmount: number,
): LessonLineItemDraft {
  return {
    lessonId: lesson.id,
    description: buildLessonDescription(lesson),
    durationMinutes: lesson.durationMinutes,
    rateType,
    unitAmount: defaultUnitAmount(expectedAmount),
    quantity: defaultQuantity(rateType, lesson.durationMinutes),
  };
}
