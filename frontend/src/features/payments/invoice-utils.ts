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
  card: "Card",
  stripe: "Stripe",
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  return amount % 1 === 0
    ? formatCurrency(amount).replace(/\.00$/, "")
    : formatCurrency(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isOverdue(invoice: InvoiceResponse): boolean {
  return (
    (invoice.status === "open" || invoice.status === "overdue") &&
    new Date(invoice.dueDate).getTime() < Date.now()
  );
}
