import type {
  InvoiceResponse,
  InvoiceStatus,
  PaymentMethod,
} from "@examify-tms/interfaces";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

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
