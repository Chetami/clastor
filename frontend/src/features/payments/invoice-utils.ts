import type { InvoiceStatus } from "@examify-tms/interfaces";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * UI-specific mapping of invoice status → badge variant. Stays in the web
 * client because it depends on the shadcn Badge component. Everything else
 * (formatters, line-item builders, labels, config) lives in
 * @examify-tms/shared and is re-exported below for convenience.
 */
export const STATUS_META: Record<
  InvoiceStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "muted" },
  open: { label: "Open", variant: "secondary" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  void: { label: "Void", variant: "outline" },
};

export {
  DEFAULT_INVOICE_DUE_DAYS,
  defaultInvoiceDueDate,
  defaultInvoiceDueDateInput,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatDateTime,
  isOverdue,
  buildLessonDescription,
  buildLessonLineItem,
  isCancelledLesson,
  isPastLesson,
  isExcludedFromInvoicing,
  isChargeableAttendance,
  partitionInvoiceableLessons,
  type LessonLineItemDraft,
  type CompletedLessonsGroup,
  type InvoiceableLessonGroups,
} from "@examify-tms/shared";
