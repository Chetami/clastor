import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";
import {
  Ban,
  Clock,
  CalendarClock,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Repeat,
  StickyNote,
  User,
  Video,
  RefreshCw,
  CheckCircle2,
  CloudOff,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useListStudents } from "@/features/students/api";
import { useGoogleConnectionStatus } from "@/features/settings/api/use-google-connect";
import {
  useCancelLesson,
  useGetLesson,
  useNotifyStudent,
  useUpdateLesson,
  useResyncLesson,
} from "./api";
import { generateMeetLinkRequest } from "./api/requests";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  deriveLessonStatus,
  isLessonFinished,
} from "./lesson-utils";
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

const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-muted text-muted-foreground",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
  const cancelLesson = useCancelLesson(lessonId ?? "");
  const notifyStudent = useNotifyStudent(lessonId ?? "");
  const updateLesson = useUpdateLesson(lessonId ?? "");
  const resyncLesson = useResyncLesson(lessonId ?? "");
  const { data: googleStatus } = useGoogleConnectionStatus();
  const googleConnected = !!googleStatus?.connected;
  const [actionError, setActionError] = useState<string | null>(null);
  const [meetLoading, setMeetLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const studentName = lesson
    ? (students.find((s) => s.id === lesson.studentId)?.name ?? "Unknown student")
    : null;

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

  function openNotifyDialog() {
    if (!lesson || !studentName) return;
    setNotifyError(null);
    const subjectPart = lesson.subject ? ` ${lesson.subject}` : "";
    setNotifyMessage(
      `Hi ${studentName},\n\nThis is a reminder about our upcoming${subjectPart} lesson on ${formatDateTime(lesson.startDateTime)}.\n\nLooking forward to seeing you!`,
    );
    setNotifyOpen(true);
  }

  async function handleNotify() {
    if (!lessonId) return;
    setNotifyError(null);
    try {
      await notifyStudent.mutateAsync(notifyMessage || undefined);
      setNotifyOpen(false);
    } catch {
      setNotifyError(
        notifyStudent.error?.message ?? "Failed to notify student",
      );
    }
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
      // Persist so the popover flips to "Open Google Meet" and the
      // dashboard/calendar reflect it. No new tab — user opens it themselves.
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

  async function handleResync() {
    if (!lessonId) return;
    setActionError(null);
    try {
      const { action } = await resyncLesson.mutateAsync();
      toast.success(
        action === "created"
          ? "Added to Google Calendar."
          : action === "recreated"
            ? "Recovered on Google Calendar."
            : "Already up to date on Google Calendar.",
      );
    } catch {
      setActionError(
        resyncLesson.error?.message ?? "Failed to sync to Google Calendar",
      );
    }
  }

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
        className="gi-popover-shell w-80 p-0"
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
              status={deriveLessonStatus(
                lesson.attendanceStatus,
                lesson.isCancelled,
              )}
              isRecurring={!!lesson.seriesId}
              seriesId={lesson.seriesId ?? null}
              isCancelled={lesson.isCancelled ?? false}
            acceptanceLabel={ACCEPTANCE_LABELS[lesson.acceptanceStatus]}
            attendanceLabel={ATTENDANCE_LABELS[lesson.attendanceStatus]}
            lessonFinished={isLessonFinished(lesson)}
            notifiedAtIso={lesson.lastStudentNotifiedAt}
            notifyCount={lesson.studentNotifiedCount}
            notifyPending={notifyStudent.isPending}
            cancelPending={cancelLesson.isPending}
            actionError={actionError}
            lessonId={lesson.id}
            onNotify={openNotifyDialog}
            onReschedule={() => setRescheduleOpen(true)}
            onCancel={handleCancel}
            onGenerateMeet={handleGenerateMeet}
            meetLoading={meetLoading}
            googleConnected={googleConnected}
            googleSynced={!!lesson.googleCalendarEventId}
            onResync={handleResync}
            resyncPending={resyncLesson.isPending}
          />
        )}
        </div>
      </PopoverContent>
    </Popover>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify {studentName ?? "student"}</DialogTitle>
            <DialogDescription>
              Send a reminder email to the student. Lesson details are appended
              automatically. You can resend once every 24 hours.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {notifyError && (
            <p className="text-xs text-destructive">{notifyError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotifyOpen(false)}
              disabled={notifyStudent.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNotify}
              disabled={notifyStudent.isPending}
            >
              {notifyStudent.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {notifyStudent.isPending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  status: "scheduled" | "completed" | "cancelled";
  isRecurring: boolean;
  seriesId: string | null;
  isCancelled: boolean;
  acceptanceLabel: string;
  attendanceLabel: string;
  lessonFinished: boolean;
  notifiedAtIso: string | null | undefined;
  notifyCount: number | undefined;
  notifyPending: boolean;
  cancelPending: boolean;
  actionError: string | null;
  lessonId: string;
  onNotify: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onGenerateMeet: () => void;
  meetLoading: boolean;
  googleConnected: boolean;
  googleSynced: boolean;
  onResync: () => void;
  resyncPending: boolean;
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
  status,
  isRecurring,
  seriesId,
  isCancelled,
  acceptanceLabel,
  attendanceLabel,
  lessonFinished,
  notifiedAtIso,
  notifyCount,
  notifyPending,
  cancelPending,
  actionError,
  lessonId,
  onNotify,
  onReschedule,
  onCancel,
  onGenerateMeet,
  meetLoading,
  googleConnected,
  googleSynced,
  onResync,
  resyncPending,
}: PopoverBodyProps) {
  const meetLink = lessonMeetLink ?? null;
  const notifiedAt = notifiedAtIso ? new Date(notifiedAtIso) : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;

  return (
    <div className="flex flex-col">
      <div className="space-y-2 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">
            {subject || "Lesson"}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{studentName}</span>
          {isRecurring && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                Recurring
              </span>
            </>
          )}
        </div>
      </div>

      <dl className="space-y-2 p-4 text-xs">
        <Detail icon={<Clock className="h-3.5 w-3.5" />} label="When">
          {formatDateTime(startIso)}
          <span className="block text-muted-foreground">
            {formatTime(startIso)} – {formatTime(endIso)} ({durationMinutes} min)
          </span>
        </Detail>

        <Detail
          icon={
            meetLink ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )
          }
          label="Location"
        >
          <div className="flex flex-wrap items-center gap-2">
            {location ? (
              <span className="font-medium">{location}</span>
            ) : (
              <span className="text-muted-foreground">Not specified</span>
            )}
            {meetLink ? (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open Google Meet
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
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
                Generate Meet
              </Button>
            )}
          </div>
        </Detail>

        <Detail icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes">
          {notes ? (
            <p className="line-clamp-3 whitespace-pre-wrap font-medium">
              {notes}
            </p>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Detail>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Acceptance</p>
            <p className="font-medium">{acceptanceLabel}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Attendance</p>
            <p className="font-medium">{attendanceLabel}</p>
          </div>
        </div>

        {googleConnected && (
          <div
            className={
              "mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium " +
              (googleSynced
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400")
            }
          >
            {googleSynced ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            {googleSynced
              ? "On Google Calendar"
              : "Not on Google Calendar"}
          </div>
        )}
      </dl>

      {actionError && (
        <p className="px-4 pb-2 text-xs text-destructive">{actionError}</p>
      )}

      {!isCancelled && (
        <div className="flex flex-wrap items-center gap-2 border-t p-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onReschedule}
            disabled={lessonFinished}
            title={
              lessonFinished
                ? "Cannot reschedule finished lessons"
                : "Move this lesson to a new time"
            }
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onNotify}
            disabled={notifyPending || cooldownActive}
            title={
              cooldownActive && nextAllowedAt
                ? `Already notified — can resend after ${nextAllowedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : "Send a reminder email to the student"
            }
          >
            {notifyPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            {notifiedAt ? "Notify again" : "Notify"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={cancelPending || lessonFinished}
            title={
              lessonFinished
                ? "Cannot cancel finished lessons"
                : "Cancel this occurrence"
            }
            className="text-destructive hover:text-destructive"
          >
            {cancelPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
            Cancel
          </Button>
          {googleConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={onResync}
              disabled={resyncPending}
              title={
                googleSynced
                  ? "Update the Google Calendar event, or recover it if it was deleted"
                  : "Add this lesson to your Google Calendar"
              }
            >
              {resyncPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {googleSynced ? "Resync" : "Add to Google"}
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild className="ml-auto">
            <Link to={seriesId ? `/lessons/series/${seriesId}` : `/lessons/${lessonId}`}>
              Open
            </Link>
          </Button>
        </div>
      )}

      {notifiedAt && (
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Last notified{" "}
          {notifiedAt.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {notifyCount ? ` · ${notifyCount} sent` : ""}
        </p>
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
