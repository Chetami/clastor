import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  addMilliseconds,
  compareAsc,
  compareDesc,
  differenceInMilliseconds,
} from "date-fns";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  formatCurrency,
  formatDate,
  isCancelledLesson,
  isPastLesson,
  partitionInvoiceableLessons,
} from "@/features/payments/invoice-utils";
import {
  INVOICE_RESEND_COOLDOWN_MS,
  formatMsRemaining,
} from "@examify-tms/shared";
import {
  formatLessonDate,
  formatLessonTime,
  getInitials,
} from "@/features/lessons/lesson-display";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "present",
  present_late: "late",
  absent_no_makeup: "absent",
  absent_makeup_issued: "absent (makeup issued)",
  absent_warning: "absent (warning)",
  tutor_cancelled: "tutor cancelled",
  tutor_cancelled_makeup_issued: "tutor cancelled (makeup issued)",
  unrecorded: "unrecorded",
};

interface OverdueRow {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  /** ISO time the invoice was last emailed, or null if never sent. */
  sentAt: string | null;
}

/**
 * Three "needs attention" cards shown above the lessons browse list:
 *   1. Needs invoicing        — past lessons with attendance marked, a
 *                               billable outcome, and no invoice yet
 *   2. Attendance not marked  — past lessons whose attendance is still
 *                               unrecorded (a prerequisite to invoicing)
 *   3. Overdue                — lessons sitting on an unpaid, overdue invoice
 *
 * Each row carries a one-tap action; each card fetches its own data
 * (deduped by React Query) and renders nothing when empty, keeping the page
 * quiet when the tutor is all caught up.
 */
export function ActionableLessons() {
  const navigate = useNavigate();
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();

  // `unpaid: true` on the backend already excludes lessons that have an
  // invoiceId OR are marked paid, so this is exactly the uninvoiced set.
  const { data: unpaidLessons = [], isLoading: lessonsLoading } =
    useListLessons({ unpaid: true });
  // Past lessons whose attendance is still pending — the prerequisite to
  // being able to invoice them.
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

  // Per-student list of allowed subject names (from the tutor's catalogue),
  // used to constrain the subject selector in the attendance dialog.
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
  // eligibility rules (absent-with-credit / warned / tutor-cancelled are never
  // billable) stay identical to the Create Invoice page.
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
    // Most overdue first.
    rows.sort((a, b) => compareAsc(new Date(a.dueDate), new Date(b.dueDate)));
    return rows;
  }, [overdueInvoices]);

  // Attendance dialog state. The lesson object is captured (not just its id)
  // so the dialog + handler stay valid even once a successful mark refetches
  // the list and the lesson drops out of `attendanceDue`.
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

      // Apply any lesson tweaks first — this happens whether or not an
      // invoice is sent, since the lesson should reflect what was done.
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
        effective = await updateLessonDetails.mutateAsync({
          id: lessonId,
          data,
        });
      }

      if (shouldInvoice) {
        const student = studentById[lesson.studentId];
        if (student) {
          // Create the invoice but DON'T email yet — open the compose dialog so
          // the tutor reviews/edits the email before it goes out.
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

  function handleRemind(row: OverdueRow) {
    setSendInvoiceId(row.invoiceId);
  }

  const loading = lessonsLoading || unrecordedLoading || invoicesLoading;
  const hasNeedsInvoicing = needsInvoicing.length > 0;
  const hasAttendanceDue = attendanceDue.length > 0;
  const hasOverdue = overdueRows.length > 0;

  // Tick "now" once a minute while the overdue card is visible so the
  // remind-cooldown countdowns stay fresh without re-rendering otherwise.
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
        {/* Needs invoicing */}
        {hasNeedsInvoicing && (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold tracking-tight">
                  Needs invoicing
                </h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {needsInvoicing.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="max-h-80 divide-y overflow-y-auto">
                {needsInvoicing.map((lesson) => {
                  const name =
                    studentNames[lesson.studentId] ?? "Unknown student";
                  return (
                    <li
                      key={lesson.id}
                      className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lesson.subject || "Lesson"}
                            <span className="mx-1 text-muted-foreground/50">
                              ·
                            </span>
                            {formatLessonDate(lesson.startDateTime)}
                            <span className="mx-1 text-muted-foreground/50">
                              ·
                            </span>
                            {formatLessonTime(lesson.startDateTime)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-24 shrink-0 gap-1.5 px-2.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/payments/new?student=${lesson.studentId}&lesson=${lesson.id}`,
                          );
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Attendance not marked */}
        {hasAttendanceDue && (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-semibold tracking-tight">
                  Attendance not marked
                </h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {attendanceDue.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="max-h-80 divide-y overflow-y-auto">
                {attendanceDue.map((lesson) => {
                  const name =
                    studentNames[lesson.studentId] ?? "Unknown student";
                  return (
                    <li
                      key={lesson.id}
                      className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-medium text-sky-600 dark:text-sky-400">
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lesson.subject || "Lesson"}
                            <span className="mx-1 text-muted-foreground/50">
                              ·
                            </span>
                            {formatLessonDate(lesson.startDateTime)}
                            <span className="mx-1 text-muted-foreground/50">
                              ·
                            </span>
                            {formatLessonTime(lesson.startDateTime)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-24 shrink-0 gap-1.5 px-2.5 text-xs"
                        disabled={attendancePending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogLesson(lesson);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Overdue */}
        {hasOverdue && (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h3 className="text-sm font-semibold tracking-tight">
                  Overdue
                </h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {overdueRows.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="max-h-80 divide-y overflow-y-auto">
                {overdueRows.map((row) => {
                  const sending =
                    sendInvoice.isPending &&
                    sendInvoice.variables?.id === row.invoiceId;
                  // The instant the cooldown lifts (last sent + 24h), or null
                  // if the invoice has never been sent.
                  const availableAt = row.sentAt
                    ? addMilliseconds(new Date(row.sentAt), INVOICE_RESEND_COOLDOWN_MS)
                    : null;
                  const remaining = availableAt
                    ? differenceInMilliseconds(availableAt, now)
                    : 0;
                  const onCooldown = remaining > 0;
                  return (
                    <li
                      key={row.key}
                      className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
                      onClick={() => navigate(`/payments/${row.invoiceId}`)}
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-24 shrink-0 gap-1.5 px-2.5 text-xs"
                        disabled={sendInvoice.isPending || onCooldown}
                        title={
                          onCooldown
                            ? `Last reminder sent ${formatDate(row.sentAt!)}`
                            : "Send a reminder email"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemind(row);
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
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
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
