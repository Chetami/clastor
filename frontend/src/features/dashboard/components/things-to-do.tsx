import { useState } from "react";
import { Link } from "react-router-dom";
import {
  addMilliseconds,
  differenceInMilliseconds,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  FileText,
  ListTodo,
  Loader2,
  Send,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse, AttendanceStatus } from "@examify-tms/interfaces";
import {
  INVOICE_RESEND_COOLDOWN_MS,
  formatMsRemaining,
} from "@examify-tms/shared";
import { useMarkLessonDone } from "../api";
import {
  lessonTimeRange,
  relativeDayLabel,
  type LessonChecklistItem,
} from "../lib";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import { EmailGuard } from "@/components/email-guard";
import type { InvoiceLessonEdits } from "@/features/payments/api";
import { formatCurrency, formatDate } from "@/features/payments/invoice-utils";
import { ATTENDANCE_LABELS } from "@/features/schedule/lesson-utils";
import { useNow } from "@/lib/use-now";

/** A flattened overdue invoice line-item row (one invoice × one lesson). */
export interface OverdueRow {
  key: string;
  invoiceId: string;
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

type Props = {
  attendanceLessons: LessonResponse[];
  invoiceLessons: LessonResponse[];
  invoiceLoading: boolean;
  overdueRows: OverdueRow[];
  overdueLoading: boolean;
  checklistItems: LessonChecklistItem[];
  studentNames: Record<string, string>;
  studentSubjectOptions: Record<string, string[]>;
  onConfirm: (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => Promise<void>;
  onInvoice: (lesson: LessonResponse) => void;
  /** Navigate to an invoice's detail page (overdue row click). */
  onOpenInvoice: (invoiceId: string) => void;
};

export function ThingsToDo({
  attendanceLessons,
  invoiceLessons,
  invoiceLoading,
  overdueRows,
  overdueLoading,
  checklistItems,
  studentNames,
  studentSubjectOptions,
  onConfirm,
  onInvoice,
  onOpenInvoice,
}: Props) {
  const markDone = useMarkLessonDone();
  const [openDialogLessonId, setOpenDialogLessonId] = useState<string | null>(
    null,
  );
  // Remind flow reuses SendInvoiceDialog; the dialog's own send mutation lives
  // inside it, so we only track which invoice id (if any) is open.
  const [remindInvoiceId, setRemindInvoiceId] = useState<string | null>(null);
  // Covers the full confirm chain (attendance + lesson edits + invoice
  // creation), not just the attendance mutation — otherwise the Confirm
  // button re-enables mid-chain and a second click double-invoices.
  const [confirmPending, setConfirmPending] = useState(false);
  // Once the user picks a tab it wins; until then the selection follows the
  // first non-empty tab (Radix defaultValue alone would freeze the initial
  // choice even when later-loading data makes it the wrong one).
  const [tab, setTab] = useState<string | null>(null);

  const counts = {
    attendance: attendanceLessons.length,
    invoice: invoiceLessons.length,
    overdue: overdueRows.length,
    tasks: checklistItems.length,
  };
  const invoicingTotal = counts.invoice + counts.overdue;
  const total = counts.attendance + invoicingTotal + counts.tasks;
  const hasAny = total > 0;

  // Default to the first non-empty tab so the panel never opens on an empty
  // list while work is pending elsewhere.
  const defaultTab =
    counts.attendance > 0
      ? "attendance"
      : invoicingTotal > 0
        ? "invoicing"
        : "tasks";

  const handleConfirm = async (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => {
    const lesson = attendanceLessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const name = studentNames[lesson.studentId] ?? "Unknown student";
    setConfirmPending(true);
    try {
      await markDone.mutateAsync({ id: lessonId, attendanceStatus });
      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
      await onConfirm(lessonId, attendanceStatus, sendInvoice, edits);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Attendance recorded, but the follow-up step failed",
      );
      throw err;
    } finally {
      setConfirmPending(false);
    }
  };

  const openDialogLesson = openDialogLessonId
    ? attendanceLessons.find((l) => l.id === openDialogLessonId)
    : undefined;
  const openDialogStudentName = openDialogLesson
    ? (studentNames[openDialogLesson.studentId] ?? "Unknown student")
    : undefined;

  return (
    <>
      <Card data-tour="things-to-do" className="flex flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Things to do</CardTitle>
          </div>
          {hasAny && <Badge variant="secondary">{total}</Badge>}
        </CardHeader>
        <CardContent className="flex-1">
          {!hasAny ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <Tabs value={tab ?? defaultTab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">
                  Attendance
                  <CountBadge count={counts.attendance} />
                </TabsTrigger>
                <TabsTrigger value="invoicing">
                  Invoicing
                  <CountBadge count={invoicingTotal} />
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  Tasks
                  <CountBadge count={counts.tasks} />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-2">
                <AttendanceList
                  lessons={attendanceLessons}
                  studentNames={studentNames}
                  onMark={setOpenDialogLessonId}
                  markDonePending={markDone.isPending}
                  markDoneId={markDone.variables?.id}
                />
              </TabsContent>

              <TabsContent value="invoicing" className="mt-2">
                <InvoicingTab
                  invoiceLessons={invoiceLessons}
                  invoiceLoading={invoiceLoading}
                  overdueRows={overdueRows}
                  overdueLoading={overdueLoading}
                  studentNames={studentNames}
                  onInvoice={onInvoice}
                  onOpenInvoice={onOpenInvoice}
                  onRemind={(id) => setRemindInvoiceId(id)}
                />
              </TabsContent>

              <TabsContent value="tasks" className="mt-2">
                <ChecklistList
                  items={checklistItems}
                  studentNames={studentNames}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {openDialogLesson && openDialogStudentName && (
        <MarkAttendanceDialog
          open={!!openDialogLesson}
          onOpenChange={(open) =>
            setOpenDialogLessonId(open ? openDialogLessonId : null)
          }
          lesson={openDialogLesson}
          studentName={openDialogStudentName}
          subjectOptions={
            studentSubjectOptions[openDialogLesson.studentId] ?? []
          }
          onConfirm={handleConfirm}
          isPending={markDone.isPending || confirmPending}
        />
      )}

      <SendInvoiceDialog
        invoiceId={remindInvoiceId}
        onClose={() => setRemindInvoiceId(null)}
      />
    </>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">
      {count}
    </span>
  );
}

const EMPTY_HINT: Record<string, string> = {
  attendance: "No lessons awaiting attendance.",
  tasks: "No pending lesson todos.",
};

function EmptyRow({ hint }: { hint: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{hint}</p>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function AttendanceList({
  lessons,
  studentNames,
  onMark,
  markDonePending,
  markDoneId,
}: {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
  onMark: (lessonId: string) => void;
  markDonePending: boolean;
  markDoneId?: string;
}) {
  if (lessons.length === 0) {
    return <EmptyRow hint={EMPTY_HINT.attendance} />;
  }
  return (
    <ScrollArea className="h-[220px] pr-3">
      <ul className="space-y-2">
        {lessons.map((l) => {
          const name = studentNames[l.studentId] ?? "Unknown student";
          return (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <Link
                  to={`/lessons/${l.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {(l.subject ?? "Lesson")} · {relativeDayLabel(l.startDateTime)}{" "}
                  · {lessonTimeRange(l)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={markDonePending}
                onClick={() => onMark(l.id)}
              >
                {markDonePending && markDoneId === l.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
                Attendance
              </Button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

function InvoicingTab({
  invoiceLessons,
  invoiceLoading,
  overdueRows,
  overdueLoading,
  studentNames,
  onInvoice,
  onOpenInvoice,
  onRemind,
}: {
  invoiceLessons: LessonResponse[];
  invoiceLoading: boolean;
  overdueRows: OverdueRow[];
  overdueLoading: boolean;
  studentNames: Record<string, string>;
  onInvoice: (lesson: LessonResponse) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onRemind: (invoiceId: string) => void;
}) {
  // Tick once a minute so the resend-cooldown countdowns stay fresh. Only
  // mounts while the Invoicing tab is active, so it doesn't run elsewhere.
  const now = useNow(60_000);
  const anyLoading = invoiceLoading || overdueLoading;
  const anyItems = invoiceLessons.length > 0 || overdueRows.length > 0;

  if (anyLoading && !anyItems) return <LoadingRow />;
  if (!anyItems) {
    return <EmptyRow hint="Nothing to invoice or chase right now." />;
  }

  return (
    <ScrollArea className="h-[220px] pr-3">
      <div className="space-y-4">
        <section>
          <SectionHeader label="To invoice" count={invoiceLessons.length} />
          {invoiceLoading ? (
            <SectionHint text="Loading…" />
          ) : invoiceLessons.length === 0 ? (
            <SectionHint text="Nothing to invoice." />
          ) : (
            <ul className="space-y-2">
              {invoiceLessons.map((lesson) => (
                <InvoiceItem
                  key={lesson.id}
                  lesson={lesson}
                  name={studentNames[lesson.studentId] ?? "Unknown student"}
                  onInvoice={onInvoice}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader label="Overdue" count={overdueRows.length} />
          {overdueLoading ? (
            <SectionHint text="Loading…" />
          ) : overdueRows.length === 0 ? (
            <SectionHint text="No overdue invoices." />
          ) : (
            <ul className="space-y-2">
              {overdueRows.map((row) => (
                <OverdueItem
                  key={row.key}
                  row={row}
                  now={now}
                  onRowClick={() => onOpenInvoice(row.invoiceId)}
                  onRemind={() => onRemind(row.invoiceId)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 px-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {count > 0 && (
        <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

function SectionHint({ text }: { text: string }) {
  return <p className="px-1 py-1 text-xs text-muted-foreground">{text}</p>;
}

function InvoiceItem({
  lesson,
  name,
  onInvoice,
}: {
  lesson: LessonResponse;
  name: string;
  onInvoice: (lesson: LessonResponse) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-0.5">
        <Link
          to={`/lessons/${lesson.id}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {(lesson.subject ?? "Lesson")} ·{" "}
          {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => onInvoice(lesson)}
      >
        <FileText className="size-3" />
        Invoice
      </Button>
    </li>
  );
}

interface OverdueItemProps {
  row: OverdueRow;
  now: number;
  onRowClick: () => void;
  onRemind: () => void;
}

/**
 * An overdue invoice line-item row with a cooldown-aware "Remind" button.
 * Exported so the EmailGuard-on-Remind behaviour is unit-tested.
 */
export function OverdueItem({
  row,
  now,
  onRowClick,
  onRemind,
}: OverdueItemProps) {
  // The instant the cooldown lifts (last sent + 24h), or null if never sent.
  const availableAt = row.sentAt
    ? addMilliseconds(new Date(row.sentAt), INVOICE_RESEND_COOLDOWN_MS)
    : null;
  const remaining = availableAt
    ? differenceInMilliseconds(availableAt, now)
    : 0;
  const onCooldown = remaining > 0;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <button
        type="button"
        onClick={onRowClick}
        aria-label={`${row.customerName} — ${row.description}. ${formatCurrency(row.amount, row.currency)} due ${formatDate(row.dueDate)}. Open invoice.`}
        className="min-w-0 flex-1 space-y-0.5 text-left"
      >
        <p className="truncate text-sm font-medium hover:underline">
          {row.customerName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.description}
        </p>
        <p className="text-xs">
          <span className="font-medium">
            {formatCurrency(row.amount, row.currency)}
          </span>
          <span className="ml-1.5 text-rose-600 dark:text-rose-400">
            Due {formatDate(row.dueDate)}
          </span>
        </p>
      </button>
      <EmailGuard hasEmail={!!row.billingEmail?.trim()}>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={onCooldown}
          title={
            onCooldown
              ? `Last reminder sent ${formatDate(row.sentAt!)}`
              : "Send a reminder email"
          }
          onClick={onRemind}
        >
          {onCooldown ? (
            <Clock className="size-3" />
          ) : (
            <Send className="size-3" />
          )}
          {onCooldown ? formatMsRemaining(remaining) : "Remind"}
        </Button>
      </EmailGuard>
    </li>
  );
}

function ChecklistList({
  items,
  studentNames,
}: {
  items: LessonChecklistItem[];
  studentNames: Record<string, string>;
}) {
  if (items.length === 0) {
    return <EmptyRow hint={EMPTY_HINT.tasks} />;
  }
  return (
    <ScrollArea className="h-[220px] pr-3">
      <ul className="space-y-2">
        {items.map(({ lesson, todo }) => {
          const name = studentNames[lesson.studentId] ?? "Unknown student";
          return (
            <li key={`${lesson.id}-${todo.id}`}>
              <Link
                to={`/lessons/${lesson.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="line-clamp-2 break-words text-sm font-medium">
                    {todo.text}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {name}
                    {lesson.subject ? ` · ${lesson.subject}` : ""} ·{" "}
                    {relativeDayLabel(lesson.startDateTime)} ·{" "}
                    {lessonTimeRange(lesson)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
