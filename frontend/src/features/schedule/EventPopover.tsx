import { useMemo, useState } from "react";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import { lessonIssues } from "@/features/lessons/lesson-series-utils";
import {
  useMarkLessonDone,
  useUpdateLessonDetails,
} from "@/features/dashboard/api";
import {
  useInvoiceLesson,
  useSendInvoice,
  previewSendInvoiceRequest,
  type InvoiceLessonEdits,
} from "@/features/payments/api";
import {
  useCancelLesson,
  useGetLesson,
  useNotifyStudent,
  useUpdateLesson,
  previewNotifyStudentRequest,
} from "./api";
import { generateMeetLinkRequest } from "./api/requests";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import { ATTENDANCE_LABELS, isLessonFinished } from "./lesson-utils";
import { RescheduleDialog } from "./RescheduleDialog";
import { CancelLessonDialog } from "./CancelLessonDialog";
import { PopoverBody } from "./event-popover/PopoverBody";
import { lessonStatusBadge } from "./event-popover/helpers";

export interface EventAnchor {
  getBoundingClientRect: () => DOMRect;
}

interface EventPopoverProps {
  lessonId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: EventAnchor | null;
}

/**
 * Calendar event popover — the container. Owns data fetching, mutations, and
 * the action handlers; the visible body (header, details, action rows) is
 * rendered by the extracted {@link PopoverBody}.
 */
export function EventPopover({
  lessonId,
  open,
  onOpenChange,
  anchor,
}: EventPopoverProps) {
  const { data: lesson, isLoading } = useGetLesson(lessonId ?? undefined);
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const cancelLesson = useCancelLesson(lessonId ?? "");
  const notifyStudent = useNotifyStudent(lessonId ?? "");
  const updateLesson = useUpdateLesson(lessonId ?? "");
  const markDone = useMarkLessonDone();
  const updateLessonDetails = useUpdateLessonDetails();
  const invoiceLesson = useInvoiceLesson();
  const sendInvoice = useSendInvoice();
  const [actionError, setActionError] = useState<string | null>(null);
  const [meetLoading, setMeetLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  const studentName = lesson
    ? (students.find((s) => s.id === lesson.studentId)?.name ?? "Unknown student")
    : null;

  const student = useMemo(
    () => (lesson ? students.find((s) => s.id === lesson.studentId) : undefined),
    [students, lesson],
  );

  const subjectOptions = useMemo(() => {
    const ids = student?.subjectIds ?? [];
    return ids
      .map((id) => subjects.find((s) => s.id === id)?.name)
      .filter((n): n is string => !!n);
  }, [student, subjects]);

  /** Compute the lesson end Date defensively (handles transient bad data). */
  const endDate = useMemo(() => {
    if (!lesson) return null;
    const startMs = new Date(lesson.startDateTime).getTime();
    if (Number.isNaN(startMs)) return null;
    return new Date(startMs + lesson.durationMinutes * 60_000);
  }, [lesson]);

  const ready = !!(lesson && studentName && endDate);

  const issues = useMemo(() => (lesson ? lessonIssues(lesson) : []), [lesson]);
  const needsAttendance = issues.some((i) => i.kind === "attendance");
  const needsInvoice = issues.some((i) => i.kind === "unpaid");

  const createInvoiceHref =
    lesson && needsInvoice
      ? `/payments/new?student=${lesson.studentId}&lesson=${lesson.id}`
      : null;
  const invoiceHref = lesson?.invoiceId
    ? `/payments/${lesson.invoiceId}`
    : null;

  async function handleNotify(message: string) {
    if (!lessonId) return;
    await notifyStudent.mutateAsync({ message: message || undefined });
    toast.success("Reminder sent");
  }

  async function handleCancel() {
    if (!lessonId || !lesson) return;
    setActionError(null);
    if (lesson.acceptanceStatus === "accepted" || lesson.seriesId) {
      setCancelOpen(true);
      return;
    }
    try {
      await cancelLesson.mutateAsync();
      onOpenChange(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to cancel lesson",
      );
    }
  }

  async function handleGenerateMeet() {
    if (!lesson) return;
    setActionError(null);
    setMeetLoading(true);
    try {
      const { meetingLink } = await generateMeetLinkRequest({
        lessonId: lesson.id,
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      await updateLesson.mutateAsync({
        location: "Google Meet",
        meetLink: meetingLink,
      });
      toast.success("Google Meet link created");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Connect your Google account to generate Meet links",
      );
    } finally {
      setMeetLoading(false);
    }
  }

  // Mirrors LessonRow's flow: mark attendance (→ "done"), optionally tweak
  // subject/duration, and optionally create an invoice to review+send.
  async function handleAttendanceConfirm(
    id: string,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) {
    if (!lesson) return;
    const name = studentName ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id, attendanceStatus });

      const hasEdits =
        edits &&
        (edits.subject !== undefined || edits.durationMinutes !== undefined);
      let effective: LessonResponse = lesson;
      if (hasEdits) {
        const data: UpdateLessonRequest = {};
        if (edits!.subject !== undefined) data.subject = edits!.subject;
        if (edits!.durationMinutes !== undefined) {
          data.durationMinutes = edits!.durationMinutes;
        }
        effective = await updateLessonDetails.mutateAsync({ id, data });
      }

      if (shouldInvoice && student) {
        const created = await invoiceLesson.mutateAsync({
          lesson: effective,
          rateType: student.rateType,
          expectedAmount: student.expectedAmount,
          skipSend: true,
        });
        toast.success(`Invoice created for ${name} — review before sending.`);
        setSendInvoiceId(created.id);
        return;
      }

      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
  }

  const detailHref = lesson?.seriesId
    ? `/lessons/series/${lesson.seriesId}`
    : lessonId
      ? `/lessons/${lessonId}`
      : "#";

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        {anchor && lessonId && (
          <PopoverAnchor virtualRef={{ current: anchor }} />
        )}
        <PopoverContent
          align="start"
          side="right"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest(".fc-event")) {
              e.preventDefault();
            }
          }}
          className="gi-popover-shell w-[22.5rem] p-0"
        >
          <div key={lessonId} className="gi-popover-animate">
            {isLoading || !ready || !lesson || !studentName || !endDate ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <PopoverBody
                subject={lesson.subject}
                studentName={studentName}
                startIso={lesson.startDateTime}
                endIso={endDate.toISOString()}
                durationMinutes={lesson.durationMinutes}
                location={lesson.location}
                lessonMeetLink={lesson.meetLink}
                notes={lesson.notes}
                badge={lessonStatusBadge(lesson)}
                seriesId={lesson.seriesId ?? null}
                isCancelled={lesson.isCancelled ?? false}
                lessonFinished={isLessonFinished(lesson)}
                notifiedAtIso={lesson.lastStudentNotifiedAt}
                notifyPending={notifyStudent.isPending}
                cancelPending={cancelLesson.isPending}
                attendancePending={
                  markDone.isPending ||
                  updateLessonDetails.isPending ||
                  invoiceLesson.isPending
                }
                needsAttendance={needsAttendance}
                createInvoiceHref={createInvoiceHref}
                invoiceHref={invoiceHref}
                actionError={actionError}
                detailHref={detailHref}
                onNotify={() => setNotifyOpen(true)}
                onReschedule={() => setRescheduleOpen(true)}
                onCancel={handleCancel}
                onGenerateMeet={handleGenerateMeet}
                onMarkAttendance={() => setAttendanceOpen(true)}
                meetLoading={meetLoading}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>

      {lesson && (
        <EmailComposeDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          title={`Notify ${studentName ?? "student"}`}
          description="Send a reminder email to the student. You can resend once every 24 hours."
          fetchPreview={(message) =>
            previewNotifyStudentRequest(lesson.id, message)
          }
          onSend={handleNotify}
        />
      )}

      {lesson && (
        <RescheduleDialog
          lesson={lesson}
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
        />
      )}

      {lesson && (
        <CancelLessonDialog
          lesson={lesson}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
      )}

      {lesson && (
        <MarkAttendanceDialog
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
          lesson={lesson}
          studentName={studentName ?? "Unknown student"}
          subjectOptions={subjectOptions}
          onConfirm={handleAttendanceConfirm}
          isPending={
            markDone.isPending ||
            updateLessonDetails.isPending ||
            invoiceLesson.isPending
          }
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
            onOpenChange(false);
            window.location.assign(`/payments/${id}`);
          }}
        />
      )}
    </>
  );
}
