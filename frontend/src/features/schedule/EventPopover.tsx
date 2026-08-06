import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  STUDENT_NOTIFY_COOLDOWN_MS,
  formatMsRemaining,
} from "@examify-tms/shared";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Repeat,
  StickyNote,
  User,
  Video,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import { lessonBadge } from "@/features/lessons/lesson-display";
import {
  ACCEPTANCE_TONE,
  lessonIssues,
} from "@/features/lessons/lesson-series-utils";
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

export interface EventAnchor {
  getBoundingClientRect: () => DOMRect;
}

interface EventPopoverProps {
  lessonId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: EventAnchor | null;
}

interface Badge {
  label: string;
  tone: string;
}

/**
 * App-wide status badge for a lesson. Matches the Lessons list / LessonRow:
 * upcoming lessons surface acceptance (Pending/Declined, or nothing when
 * accepted); past lessons show the attendance-driven label (Not recorded,
 * Present, …). Returns null when there's nothing worth surfacing.
 */
function lessonStatusBadge(lesson: LessonResponse): Badge | null {
  const base = lessonBadge(lesson);
  if (base.label === "Upcoming") {
    if (lesson.acceptanceStatus === "pending") {
      return { label: "Pending", tone: ACCEPTANCE_TONE.pending };
    }
    if (lesson.acceptanceStatus === "declined") {
      return { label: "Declined", tone: ACCEPTANCE_TONE.declined };
    }
    return null;
  }
  return base;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

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

  /**
   * Compute the lesson end Date defensively. If `startDateTime` is missing
   * or unparseable (can happen transiently during navigation / cache
   * transitions), we treat the lesson as not yet ready rather than
   * throwing inside `.toISOString()`.
   */
  const endDate = useMemo(() => {
    if (!lesson) return null;
    const startMs = new Date(lesson.startDateTime).getTime();
    if (Number.isNaN(startMs)) return null;
    return new Date(startMs + lesson.durationMinutes * 60_000);
  }, [lesson]);

  const ready = !!(lesson && studentName && endDate);

  // Past-lesson follow-ups: attendance + invoicing. `lessonIssues` only flags
  // non-cancelled, past lessons, so these drive the context actions.
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
    // Open the dialog when the student accepted (to offer notification) or
    // when the lesson belongs to a series (to offer the scope choice).
    if (lesson.acceptanceStatus === "accepted" || lesson.seriesId) {
      setCancelOpen(true);
      return;
    }
    try {
      await cancelLesson.mutateAsync();
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel lesson");
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
      await updateLesson.mutateAsync({ location: "Google Meet", meetLink: meetingLink });
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
  // subject/duration, and optionally create an invoice to review+send. Keeps
  // the popover open so the next follow-up (e.g. Create invoice) appears.
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

interface PopoverBodyProps {
  subject: string | null | undefined;
  studentName: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  location: string | null | undefined;
  lessonMeetLink?: string | null;
  notes: string | null | undefined;
  badge: Badge | null;
  seriesId: string | null;
  isCancelled: boolean;
  lessonFinished: boolean;
  notifiedAtIso: string | null | undefined;
  notifyPending: boolean;
  cancelPending: boolean;
  attendancePending: boolean;
  needsAttendance: boolean;
  createInvoiceHref: string | null;
  invoiceHref: string | null;
  actionError: string | null;
  detailHref: string;
  onNotify: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onGenerateMeet: () => void;
  onMarkAttendance: () => void;
  meetLoading: boolean;
}

function PopoverBody({
  subject,
  studentName,
  startIso,
  endIso,
  durationMinutes,
  location,
  lessonMeetLink,
  notes,
  badge,
  seriesId,
  isCancelled,
  lessonFinished,
  notifiedAtIso,
  notifyPending,
  cancelPending,
  attendancePending,
  needsAttendance,
  createInvoiceHref,
  invoiceHref,
  actionError,
  detailHref,
  onNotify,
  onReschedule,
  onCancel,
  onGenerateMeet,
  onMarkAttendance,
  meetLoading,
}: PopoverBodyProps) {
  const meetLink = lessonMeetLink ?? null;
  const notifiedAt = notifiedAtIso ? new Date(notifiedAtIso) : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;
  const cooldownRemaining =
    nextAllowedAt && cooldownActive
      ? formatMsRemaining(nextAllowedAt.getTime() - Date.now())
      : null;

  const showActions = !isCancelled;
  const showUpcomingActions = showActions && !lessonFinished;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="space-y-1.5 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">
            {subject || "Lesson"}
          </h3>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{studentName}</span>
          {seriesId && (
            <Link
              to={`/lessons/series/${seriesId}`}
              className="ml-1 inline-flex items-center gap-1 hover:text-foreground"
            >
              <Repeat className="h-3 w-3" />
              Series
            </Link>
          )}
        </div>
      </div>

      {/* Essential details */}
      <dl className="space-y-3 p-4 text-xs">
        <Detail icon={<Clock className="h-3.5 w-3.5" />} label="When">
          <div className="font-medium leading-tight">{formatDate(startIso)}</div>
          <div className="mt-0.5 text-muted-foreground">
            {formatTime(startIso)} – {formatTime(endIso)} ({durationMinutes} min)
          </div>
        </Detail>

        <Detail
          icon={
            meetLink ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )
          }
          label={meetLink ? "Google Meet" : "Location"}
        >
          <div className="flex flex-wrap items-center gap-2">
            {meetLink ? (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Join meeting
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : location ? (
              <span className="font-medium">{location}</span>
            ) : (
              <span className="text-muted-foreground">Not specified</span>
            )}
            {!meetLink && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onGenerateMeet}
                disabled={meetLoading}
              >
                {meetLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Video className="h-3 w-3" />
                )}
                Meet
              </Button>
            )}
          </div>
        </Detail>

        {notes && (
          <Detail icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes">
            <p className="line-clamp-1 whitespace-pre-wrap font-medium">
              {notes}
            </p>
          </Detail>
        )}
      </dl>

      {actionError && (
        <p className="px-4 pb-2 text-xs text-destructive">{actionError}</p>
      )}

      {/* Actions — context-sensitive. Upcoming lessons get scheduling actions;
          past lessons get follow-ups (attendance / invoicing). Each row of
          buttons stretches to fill the width equally. */}
      {showActions && (
        <div className="space-y-2 border-t p-3">
          {showUpcomingActions ? (
            <>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={onReschedule}
                  title="Move this lesson to a new time"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={onNotify}
                  disabled={notifyPending || cooldownActive}
                  title="Send a reminder email to the student"
                >
                  {notifyPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  Notify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-destructive hover:text-destructive"
                  onClick={onCancel}
                  disabled={cancelPending}
                  title="Cancel this occurrence"
                >
                  {cancelPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  Cancel
                </Button>
              </div>
              {cooldownRemaining && (
                <p className="text-[11px] text-muted-foreground">
                  Student notified — can resend in {cooldownRemaining}
                </p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              {needsAttendance && (
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={onMarkAttendance}
                  disabled={attendancePending}
                >
                  {attendancePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ClipboardList className="h-3.5 w-3.5" />
                  )}
                  Mark attendance
                </Button>
              )}
              {createInvoiceHref && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  asChild
                >
                  <Link to={createInvoiceHref}>
                    <FileText className="h-3.5 w-3.5" />
                    Create invoice
                  </Link>
                </Button>
              )}
              {invoiceHref && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  asChild
                >
                  <Link to={invoiceHref}>
                    <FileText className="h-3.5 w-3.5" />
                    View invoice
                  </Link>
                </Button>
              )}
            </div>
          )}
          <Button size="sm" variant="secondary" className="w-full gap-1" asChild>
            <Link to={detailHref}>
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {isCancelled && (
        <div className="border-t p-3">
          <Button size="sm" variant="secondary" className="w-full gap-1" asChild>
            <Link to={detailHref}>
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

interface DetailProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function Detail({ icon, label, children }: DetailProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground">{label}</p>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
