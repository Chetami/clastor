import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
} from "lucide-react";
import { compareAsc, compareDesc } from "date-fns";
import type { AttendanceStatus, LessonResponse } from "@examify-tms/interfaces";
import { useListLessons } from "@/features/schedule/api";
import {
  useListInvoices,
  type InvoiceLessonEdits,
} from "@/features/payments/api";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import { useMarkAttendanceAndInvoice } from "@/hooks/use-mark-attendance-and-invoice";
import {
  isCancelledLesson,
  isPastLesson,
  partitionInvoiceableLessons,
} from "@/features/payments/invoice-utils";
import {
  ActionCard,
  LessonActionRow,
  OverdueActionRow,
  type OverdueRow,
} from "./actionable/components";

/**
 * Three "needs attention" cards shown above the lessons browse list:
 * needs-invoicing, attendance-not-marked, and overdue. Each card fetches its
 * own data (deduped by React Query) and renders nothing when empty.
 */
export function ActionableLessons() {
  const navigate = useNavigate();
  const {
    names: studentNames,
    subjectOptions: studentSubjectOptions,
    confirm,
    attendancePending,
    sendInvoiceId,
    setSendInvoiceId,
  } = useMarkAttendanceAndInvoice();

  const { data: unpaidLessons = [], isLoading: lessonsLoading } =
    useListLessons({ unpaid: true });
  const { data: unrecordedLessons = [], isLoading: unrecordedLoading } =
    useListLessons({ attendanceStatus: "unrecorded" });
  const { data: overdueInvoices = [], isLoading: invoicesLoading } =
    useListInvoices({ status: "overdue" });

  // Billable, uninvoiced lessons — derived from the shared partitioner so the
  // eligibility rules stay identical to the Create Invoice page.
  const { completed: completedLessons } = useMemo(
    () => partitionInvoiceableLessons(unpaidLessons),
    [unpaidLessons],
  );
  const needsInvoicing = completedLessons.chargeable;

  const attendanceDue = useMemo(
    () =>
      unrecordedLessons
        .filter((l) => isPastLesson(l) && !isCancelledLesson(l))
        .sort((a, b) =>
          compareDesc(new Date(a.startDateTime), new Date(b.startDateTime)),
        ),
    [unrecordedLessons],
  );

  const overdueRows = useMemo<OverdueRow[]>(() => {
    const rows: OverdueRow[] = [];
    for (const inv of overdueInvoices) {
      for (const li of inv.lineItems) {
        rows.push({
          key: `${inv.id}:${li.lessonId}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          description: li.description,
          amount: li.amount,
          currency: inv.currency,
          dueDate: inv.dueDate,
          sentAt: inv.sentAt ?? null,
        });
      }
    }
    rows.sort((a, b) => compareAsc(new Date(a.dueDate), new Date(b.dueDate)));
    return rows;
  }, [overdueInvoices]);

  const [dialogLesson, setDialogLesson] = useState<LessonResponse | null>(null);

  async function handleAttendanceConfirm(
    _lessonId: string,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) {
    if (!dialogLesson) return;
    const result = await confirm(
      dialogLesson,
      attendanceStatus,
      shouldInvoice,
      edits,
    );
    if (result.invoiceId) setDialogLesson(null);
  }

  const loading = lessonsLoading || unrecordedLoading || invoicesLoading;
  const hasNeedsInvoicing = needsInvoicing.length > 0;
  const hasAttendanceDue = attendanceDue.length > 0;
  const hasOverdue = overdueRows.length > 0;

  // Tick "now" once a minute while the overdue card is visible so the
  // remind-cooldown countdowns stay fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasOverdue) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [hasOverdue]);

  if (loading || (!hasNeedsInvoicing && !hasAttendanceDue && !hasOverdue))
    return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasNeedsInvoicing && (
          <ActionCard
            icon={<FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            title="Needs invoicing"
            count={needsInvoicing.length}
          >
            {needsInvoicing.map((lesson) => (
              <LessonActionRow
                key={lesson.id}
                name={studentNames[lesson.studentId] ?? "Unknown student"}
                subject={lesson.subject ?? ""}
                startDateTime={lesson.startDateTime}
                tone="primary"
                actionLabel="Invoice"
                actionIcon={<FileText className="h-3.5 w-3.5" />}
                onRowClick={() => navigate(`/lessons/${lesson.id}`)}
                onActionClick={() =>
                  navigate(
                    `/payments/new?student=${lesson.studentId}&lesson=${lesson.id}`,
                  )
                }
              />
            ))}
          </ActionCard>
        )}

        {hasAttendanceDue && (
          <ActionCard
            icon={<ClipboardList className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
            title="Attendance not marked"
            count={attendanceDue.length}
          >
            {attendanceDue.map((lesson) => (
              <LessonActionRow
                key={lesson.id}
                name={studentNames[lesson.studentId] ?? "Unknown student"}
                subject={lesson.subject ?? ""}
                startDateTime={lesson.startDateTime}
                tone="sky"
                actionLabel="Mark"
                actionIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                actionDisabled={attendancePending}
                onRowClick={() => navigate(`/lessons/${lesson.id}`)}
                onActionClick={() => setDialogLesson(lesson)}
              />
            ))}
          </ActionCard>
        )}

        {hasOverdue && (
          <ActionCard
            icon={<AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
            title="Overdue"
            count={overdueRows.length}
          >
            {overdueRows.map((row) => (
              <OverdueActionRow
                key={row.key}
                row={row}
                now={now}
                // Sending progress is shown inside the SendInvoiceDialog (which
                // is modal), so the row button itself never needs a spinner.
                sending={false}
                onRowClick={() => navigate(`/payments/${row.invoiceId}`)}
                onRemind={() => setSendInvoiceId(row.invoiceId)}
              />
            ))}
          </ActionCard>
        )}
      </div>

      {dialogLesson && (
        <MarkAttendanceDialog
          open={!!dialogLesson}
          onOpenChange={(open) => {
            if (!open) setDialogLesson(null);
          }}
          lesson={dialogLesson}
          studentName={
            studentNames[dialogLesson.studentId] ?? "Unknown student"
          }
          subjectOptions={studentSubjectOptions[dialogLesson.studentId] ?? []}
          onConfirm={handleAttendanceConfirm}
          isPending={attendancePending}
        />
      )}

      {sendInvoiceId !== null && (
        <SendInvoiceDialog
          invoiceId={sendInvoiceId}
          onClose={() => setSendInvoiceId(null)}
          onSent={(id) => navigate(`/payments/${id}`)}
        />
      )}
    </>
  );
}
