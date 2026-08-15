import type {
  InvoiceResponse,
  LessonResponse,
  PaymentMethod,
  RateType,
} from "@examify-tms/interfaces";
import { compareAsc, compareDesc, format as formatDateFns, isPast } from "date-fns";
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

/**
 * Timestamps that are exactly UTC midnight are date-only values (invoice due
 * dates are created from `YYYY-MM-DD` inputs). Render the stored calendar
 * day rather than converting to local time, which shifts the date by a day
 * for users outside UTC.
 */
const DATE_ONLY_UTC_RE = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/;

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatDate(iso: string): string {
  const date = DATE_ONLY_UTC_RE.test(iso)
    ? parseDateOnly(iso)
    : new Date(iso);
  return formatDateFns(date, "d MMM yyyy");
}

export function formatDateTime(iso: string): string {
  return formatDateFns(new Date(iso), "d MMM yyyy, h:mm a");
}

export function isOverdue(invoice: InvoiceResponse): boolean {
  return (
    (invoice.status === "open" || invoice.status === "overdue") &&
    isPast(new Date(invoice.dueDate))
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

/**
 * Round a single line total to 2 decimal places. Each line is rounded
 * individually and then summed (matching the backend's subtotal math), so
 * the client-displayed total always equals the persisted one.
 */
export function roundLineAmount(unitAmount: number, quantity: number): number {
  return Math.round(unitAmount * quantity * 100) / 100;
}

/** Subtotal across line items, rounding each line first (backend parity). */
export function lineItemsSubtotal(
  items: ReadonlyArray<{ unitAmount: number; quantity: number }>,
): number {
  const sum = items.reduce(
    (acc, li) => acc + roundLineAmount(li.unitAmount, li.quantity),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Invoice eligibility — which lessons can appear on an invoice.              */
/* -------------------------------------------------------------------------- */

/** True if the lesson was cancelled (forward flag or tutor-cancelled outcome). */
export function isCancelledLesson(lesson: LessonResponse): boolean {
  return (
    lesson.isCancelled ||
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  );
}

/** True once the lesson's start time has passed. */
export function isPastLesson(lesson: LessonResponse): boolean {
  return isPast(new Date(lesson.startDateTime));
}

/**
 * Attendance outcomes that must never be invoiced: the student has already
 * been compensated (make-up credit issued) or penalised (warning issued), or
 * the tutor cancelled. These are dropped from the invoiceable set entirely.
 */
export function isExcludedFromInvoicing(lesson: LessonResponse): boolean {
  return (
    lesson.attendanceStatus === "absent_makeup_issued" ||
    lesson.attendanceStatus === "absent_warning" ||
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  );
}

/**
 * Attendance has been recorded AND the session is billable: the student
 * attended, or was absent with no make-up credit so they still pay.
 */
export function isChargeableAttendance(lesson: LessonResponse): boolean {
  return (
    lesson.attendanceStatus === "present" ||
    lesson.attendanceStatus === "present_late" ||
    lesson.attendanceStatus === "absent_no_makeup"
  );
}

/** Partition of completed (past) lessons by how they should be presented. */
export interface CompletedLessonsGroup {
  /** Recorded, billable — ready to invoice now. */
  chargeable: LessonResponse[];
  /** Past but attendance not recorded yet — needs attention before invoicing. */
  unrecorded: LessonResponse[];
}

/** Result of partitioning a student's lessons for invoice selection. */
export interface InvoiceableLessonGroups {
  upcoming: LessonResponse[];
  completed: CompletedLessonsGroup;
}

/**
 * Partition a student's lessons into invoiceable groups for the Create
 * Invoice picker.
 *
 *   - upcoming            : not started yet (and not cancelled)
 *   - completed.chargeable: past, recorded as attended / absent-no-make-up
 *                           (ready to invoice now)
 *   - completed.unrecorded: past but attendance still pending
 *
 * Cancelled, tutor-cancelled, absent-with-credit, and absent-with-warning
 * lessons are dropped entirely — they are never invoiced. Within each group
 * completed lessons sort newest-first and upcoming sort soonest-first.
 */
export function partitionInvoiceableLessons(
  lessons: LessonResponse[],
): InvoiceableLessonGroups {
  const byDateDesc = (a: LessonResponse, b: LessonResponse) =>
    compareDesc(new Date(a.startDateTime), new Date(b.startDateTime));
  const byDateAsc = (a: LessonResponse, b: LessonResponse) =>
    compareAsc(new Date(a.startDateTime), new Date(b.startDateTime));

  const eligible = lessons.filter(
    (l) => !isCancelledLesson(l) && !isExcludedFromInvoicing(l),
  );

  const chargeable: LessonResponse[] = [];
  const unrecorded: LessonResponse[] = [];
  const upcoming: LessonResponse[] = [];

  for (const lesson of eligible) {
    if (!isPastLesson(lesson)) {
      upcoming.push(lesson);
    } else if (isChargeableAttendance(lesson)) {
      chargeable.push(lesson);
    } else if (lesson.attendanceStatus === "unrecorded") {
      unrecorded.push(lesson);
    }
  }

  chargeable.sort(byDateDesc);
  unrecorded.sort(byDateDesc);
  upcoming.sort(byDateAsc);

  return { upcoming, completed: { chargeable, unrecorded } };
}
