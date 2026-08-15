import { useState } from "react";
import {
  Ban,
  CalendarClock,
  FileText,
  AlertTriangle,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  SentEmailResponse,
  SentEmailType,
} from "@examify-tms/interfaces";
import { useListSentEmails } from "./api";
import { EmailViewerDialog } from "./EmailViewerDialog";
import { formatDateTime } from "@/features/payments/invoice-utils";

export interface EmailHistoryProps {
  lessonId?: string;
  invoiceId?: string;
  studentId?: string;
  /** Render inside a Card (default) or as a bare panel. */
  variant?: "card" | "bare";
  /** Optional className on the outer Card. */
  className?: string;
}

const TYPE_META: Record<
  SentEmailType,
  { icon: LucideIcon; dot: string; iconColor: string; label: string }
> = {
  lesson_notify: {
    icon: CalendarClock,
    dot: "bg-primary",
    iconColor: "text-primary",
    label: "Lesson reminder",
  },
  lesson_cancel: {
    icon: Ban,
    dot: "bg-destructive",
    iconColor: "text-destructive",
    label: "Lesson cancellation",
  },
  invoice: {
    icon: FileText,
    dot: "bg-primary",
    iconColor: "text-primary",
    label: "Invoice",
  },
};

export function EmailHistory({
  lessonId,
  invoiceId,
  studentId,
  variant = "card",
  className,
}: EmailHistoryProps) {
  const { data, isLoading, error } = useListSentEmails({
    lessonId,
    invoiceId,
    studentId,
  });
  const emails = data?.data ?? [];
  const [selected, setSelected] = useState<SentEmailResponse | null>(null);

  const body = (
    <>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // Don't render the "No emails sent yet." success message for a
        // failed fetch — this panel is the audit trail for "did it send?".
        <p className="py-2 text-xs text-destructive">
          Couldn't load email history.
        </p>
      ) : emails.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          No emails sent yet.
        </p>
      ) : (
        <ol className="relative">
          {emails.map((email, idx) => {
            const meta = TYPE_META[email.type] ?? TYPE_META.lesson_notify;
            const Icon = email.status === "failed" ? AlertTriangle : meta.icon;
            const isLast = idx === emails.length - 1;
            const failed = email.status === "failed";
            return (
              <li
                key={email.id}
                className="group relative flex gap-2.5 pb-4 last:pb-0"
              >
                {!isLast && (
                  <span
                    className="absolute left-[5px] top-4 h-[calc(100%-0.5rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <Icon
                  className={`relative z-10 mt-0.5 h-[11px] w-[11px] shrink-0 ${
                    failed ? "text-destructive" : meta.iconColor
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelected(email)}
                    className="block w-full text-left"
                    disabled={failed || !email.bodyHtml}
                    title={
                      failed
                        ? "Send failed — no content recorded"
                        : "View email"
                    }
                  >
                    <p className="text-xs font-medium leading-snug group-enabled:group-hover:underline group-enabled:hover:underline">
                      {email.subject || meta.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      {email.to.join(", ")} · {formatDateTime(email.sentAt)}
                      {email.sentByName ? ` · ${email.sentByName}` : ""}
                    </p>
                    {failed && email.errorMessage && (
                      <p className="mt-1 text-[11px] leading-tight text-destructive">
                        {email.errorMessage}
                      </p>
                    )}
                  </button>
                </div>
                {failed && (
                  <Badge variant="danger" className="shrink-0 self-start">
                    Failed
                  </Badge>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <EmailViewerDialog
        email={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </>
  );

  if (variant === "bare") {
    return (
      <div className={className}>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Email history
        </h2>
        {body}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Email history
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
