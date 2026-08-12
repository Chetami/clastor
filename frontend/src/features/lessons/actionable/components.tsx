import type { ReactNode } from "react";
import {
  addMilliseconds,
  differenceInMilliseconds,
} from "date-fns";
import { Clock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmailGuard } from "@/components/email-guard";
import {
  INVOICE_RESEND_COOLDOWN_MS,
  formatMsRemaining,
} from "@examify-tms/shared";
import { formatCurrency, formatDate } from "@/features/payments/invoice-utils";
import {
  formatLessonDate,
  formatLessonTime,
  getInitials,
} from "@/features/lessons/lesson-display";

/** A flattened line-item row on an overdue invoice. */
export interface OverdueRow {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  /** Resolved billing email for the invoice's student (may be null). */
  billingEmail: string | null;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  /** ISO time the invoice was last emailed, or null if never sent. */
  sentAt: string | null;
}

/** Card shell shared by all three "needs attention" cards. */
export function ActionCard({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  count: number;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="max-h-80 divide-y overflow-y-auto">{children}</ul>
      </CardContent>
    </Card>
  );
}

interface LessonActionRowProps {
  name: string;
  subject: string;
  startDateTime: string;
  /** Avatar/accent tone: "primary" (invoicing) or "sky" (attendance). */
  tone: "primary" | "sky";
  actionLabel: string;
  actionIcon: ReactNode;
  actionDisabled?: boolean;
  onRowClick: () => void;
  onActionClick: () => void;
}

/** A selectable lesson row with a single inline action button. */
export function LessonActionRow({
  name,
  subject,
  startDateTime,
  tone,
  actionLabel,
  actionIcon,
  actionDisabled,
  onRowClick,
  onActionClick,
}: LessonActionRowProps) {
  return (
    <li
      className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
      onClick={onRowClick}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className={
            tone === "primary"
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-medium text-sky-600 dark:text-sky-400"
          }
        >
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {subject || "Lesson"}
            <span className="mx-1 text-muted-foreground/50">·</span>
            {formatLessonDate(startDateTime)}
            <span className="mx-1 text-muted-foreground/50">·</span>
            {formatLessonTime(startDateTime)}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-24 shrink-0 gap-1.5 px-2.5 text-xs"
        disabled={actionDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onActionClick();
        }}
      >
        {actionIcon}
        {actionLabel}
      </Button>
    </li>
  );
}

interface OverdueActionRowProps {
  row: OverdueRow;
  now: number;
  sending: boolean;
  onRowClick: () => void;
  onRemind: () => void;
}

/** An overdue invoice line-item row with a cooldown-aware "Remind" button. */
export function OverdueActionRow({
  row,
  now,
  sending,
  onRowClick,
  onRemind,
}: OverdueActionRowProps) {
  // The instant the cooldown lifts (last sent + 24h), or null if never sent.
  const availableAt = row.sentAt
    ? addMilliseconds(new Date(row.sentAt), INVOICE_RESEND_COOLDOWN_MS)
    : null;
  const remaining = availableAt ? differenceInMilliseconds(availableAt, now) : 0;
  const onCooldown = remaining > 0;

  return (
    <li
      key={row.key}
      className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
      onClick={onRowClick}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-xs font-medium text-rose-600 dark:text-rose-400">
          {getInitials(row.customerName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {row.customerName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-medium">
          {formatCurrency(row.amount, row.currency)}
        </span>
        <span className="text-[11px] text-rose-600 dark:text-rose-400">
          Due {formatDate(row.dueDate)}
        </span>
      </div>
      <EmailGuard hasEmail={!!row.billingEmail?.trim()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-24 shrink-0 gap-1.5 px-2.5 text-xs"
          disabled={sending || onCooldown}
          title={
            onCooldown
              ? `Last reminder sent ${formatDate(row.sentAt!)}`
              : "Send a reminder email"
          }
          onClick={(e) => {
            e.stopPropagation();
            onRemind();
          }}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : onCooldown ? (
            <Clock className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {onCooldown ? formatMsRemaining(remaining) : "Remind"}
        </Button>
      </EmailGuard>
    </li>
  );
}
