import { useMemo, useState } from "react";
import type { AttendanceStatus } from "@examify-tms/interfaces";
import type { InvoiceLessonEdits } from "@/features/payments/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { lessonIssues } from "@/features/lessons/lesson-series-utils";
import { useMarkAttendanceAndInvoice } from "@/hooks/use-mark-attendance-and-invoice";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
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
import { isLessonFinished } from "./lesson-utils";
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
  const cancelLesson = useCancelLesson(lessonId ?? "");
  const notifyStudent = useNotifyStudent(lessonId ?? "");
  const updateLesson = useUpdateLesson(lessonId ?? "");
  const {
    names: studentNames,
    byId: studentById,
    subjectOptions,
    confirm,
    attendancePending,
    sendInvoiceId,
    setSendInvoiceId,
  } = useMarkAttendanceAndInvoice();
  const [actionError, setActionError] = useState<string | null>(null);
  const [meetLoading, setMeetLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const studentName = lesson
    ? (studentNames[lesson.studentId] ?? "Unknown student")
    : null;

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

  // Delegates to the shared mark-attendance-and-invoice flow.
  async function handleAttendanceConfirm(
    _id: string,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) {
    if (!lesson) return;
    await confirm(lesson, attendanceStatus, shouldInvoice, edits);
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
                studentEmail={studentById[lesson.studentId]?.email ?? null}
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
                attendancePending={attendancePending}
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
          subjectOptions={subjectOptions[lesson.studentId] ?? []}
          onConfirm={handleAttendanceConfirm}
          isPending={attendancePending}
        />
      )}

      <SendInvoiceDialog
        invoiceId={sendInvoiceId}
        onClose={() => setSendInvoiceId(null)}
        onSent={() => onOpenChange(false)}
      />
    </>
  );
}
