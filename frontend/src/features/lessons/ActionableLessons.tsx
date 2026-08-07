import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { compareAsc, compareDesc } from "date-fns";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import {
  useInvoiceLesson,
  useListInvoices,
  useSendInvoice,
  previewSendInvoiceRequest,
  type InvoiceLessonEdits,
} from "@/features/payments/api";
import {
  useMarkLessonDone,
  useUpdateLessonDetails,
} from "@/features/dashboard/api";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { useSubjects } from "@/lib/subjects";
import {
  isCancelledLesson,
  isPastLesson,
  partitionInvoiceableLessons,
} from "@/features/payments/invoice-utils";
import { ATTENDANCE_LABELS } from "@/features/schedule/lesson-utils";
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
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();

  const { data: unpaidLessons = [], isLoading: lessonsLoading } =
    useListLessons({ unpaid: true });
  const { data: unrecordedLessons = [], isLoading: unrecordedLoading } =
    useListLessons({ attendanceStatus: "unrecorded" });
  const { data: overdueInvoices = [], isLoading: invoicesLoading } =
    useListInvoices({ status: "overdue" });

  const markDone = useMarkLessonDone();
  const updateLessonDetails = useUpdateLessonDetails();
  const invoiceLesson = useInvoiceLesson();
  const sendInvoice = useSendInvoice();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const studentById = useMemo(() => {
    const map: Record<string, (typeof students)[number]> = {};
    for (const s of students) map[s.id] = s;
    return map;
  }, [students]);

  const studentSubjectOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of students) {
      map[s.id] = (s.subjectIds ?? [])
        .map((id) => subjects.find((sub) => sub.id === id)?.name)
        .filter((n): n is string => !!n);
    }
    return map;
  }, [students, subjects]);

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
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  const attendancePending =
    markDone.isPending ||
    updateLessonDetails.isPending ||
    invoiceLesson.isPending;

  async function handleAttendanceConfirm(
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) {
    const lesson = dialogLesson;
    if (!lesson) return;
    const name = studentNames[lesson.studentId] ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id: lessonId, attendanceStatus });

      let effective = lesson;
      const hasEdits =
        edits &&
        (edits.subject !== undefined || edits.durationMinutes !== undefined);
      if (hasEdits) {
        const data: UpdateLessonRequest = {};
        if (edits!.subject !== undefined) data.subject = edits!.subject;
        if (edits!.durationMinutes !== undefined) {
          data.durationMinutes = edits!.durationMinutes;
        }
        effective = await updateLessonDetails.mutateAsync({ id: lessonId, data });
      }

      if (shouldInvoice) {
        const student = studentById[lesson.studentId];
        if (student) {
          const created = await invoiceLesson.mutateAsync({
            lesson: effective,
            rateType: student.rateType,
            expectedAmount: student.expectedAmount,
            skipSend: true,
          });
          toast.success(`Invoice created for ${name} — review before sending.`);
          setDialogLesson(null);
          setSendInvoiceId(created.id);
          return;
        }
      }

      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
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
                sending={
                  sendInvoice.isPending &&
                  sendInvoice.variables?.id === row.invoiceId
                }
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

      {sendInvoiceId && (
        <EmailComposeDialog
          open
          onOpenChange={(o) => !o && setSendInvoiceId(null)}
          title="Send invoice"
          description="Review and edit the email before sending. The invoice PDF is attached automatically."
          fetchPreview={(message) =>
            previewSendInvoiceRequest(sendInvoiceId, message)
          }
          onSend={async (message) => {
            await sendInvoice.mutateAsync({
              id: sendInvoiceId,
              message: message || undefined,
            });
            toast.success("Invoice sent.");
            const id = sendInvoiceId;
            setSendInvoiceId(null);
            navigate(`/payments/${id}`);
          }}
        />
      )}
    </>
  );
}
