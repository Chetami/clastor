import {
  Ban,
  CreditCard,
  Edit,
  FileText,
  Mail,
  Send,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { InvoiceEventType } from "@examify-tms/interfaces";
import { useListInvoiceEvents } from "./api";
import { formatDateTime } from "./invoice-utils";

const EVENT_META: Record<
  InvoiceEventType,
  { icon: LucideIcon; dot: string; iconColor: string }
> = {
  created: { icon: FileText, dot: "bg-border", iconColor: "text-muted-foreground" },
  updated: { icon: Edit, dot: "bg-border", iconColor: "text-muted-foreground" },
  sent: { icon: Send, dot: "bg-primary", iconColor: "text-primary" },
  resent: { icon: Mail, dot: "bg-primary", iconColor: "text-primary" },
  payment_received: {
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  paid_online: {
    icon: CreditCard,
    dot: "bg-emerald-500",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  voided: { icon: Ban, dot: "bg-destructive", iconColor: "text-destructive" },
};

export function InvoiceTimeline({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading } = useListInvoiceEvents(invoiceId);
  const events = data?.data ?? [];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Activity
      </h2>
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">
          Loading activity...
        </p>
      ) : events.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="relative">
          {events.map((event, idx) => {
            const meta = EVENT_META[event.type] ?? EVENT_META.created;
            const Icon = meta.icon;
            const isLast = idx === events.length - 1;
            return (
              <li key={event.id} className="relative flex gap-2.5 pb-4 last:pb-0">
                {!isLast && (
                  <span
                    className="absolute left-[5px] top-4 h-[calc(100%-0.5rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <Icon className={`relative z-10 mt-0.5 h-[11px] w-[11px] shrink-0 ${meta.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">
                    {event.summary}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
