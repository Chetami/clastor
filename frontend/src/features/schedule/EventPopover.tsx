import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  Clock,
  ExternalLink,
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
import { useListStudents } from "@/features/students/api";
import {
  useCancelLesson,
  useGetLesson,
  useNotifyStudent,
} from "./api";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  deriveLessonStatus,
  isLessonFinished,
} from "./lesson-utils";
import { meetUrl } from "@/features/lessons/lesson-display";

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

/** Mirrors the backend NOTIFY_COOLDOWN_MS default (24h). */
const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function handleNotify() {
    if (!lessonId) return;
    setActionError(null);
    try {
      await notifyStudent.mutateAsync(undefined);
    } catch {
      setActionError(notifyStudent.error?.message ?? "Failed to notify student");
    }
  }

  async function handleCancel() {
    if (!lessonId) return;
    setActionError(null);
    try {
      await cancelLesson.mutateAsync();
      onOpenChange(false);
    } catch {
      setActionError(cancelLesson.error?.message ?? "Failed to cancel lesson");
    }
  }

  return (
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
              notes={lesson.notes}
              status={deriveLessonStatus(
                lesson.attendanceStatus,
                lesson.isCancelled,
              )}
              isRecurring={!!lesson.seriesId}
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
            onNotify={handleNotify}
            onCancel={handleCancel}
          />
        )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PopoverBodyProps {
  subject: string;
  studentName: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  location: string | null | undefined;
  notes: string | null | undefined;
  status: "scheduled" | "completed" | "cancelled";
  isRecurring: boolean;
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
  onCancel: () => void;
}

function PopoverBody({
  subject,
  studentName,
  startIso,
  endIso,
  durationMinutes,
  location,
  notes,
  status,
  isRecurring,
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
  onCancel,
}: PopoverBodyProps) {
  const meetLink = meetUrl(location);
  const notifiedAt = notifiedAtIso ? new Date(notifiedAtIso) : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;

  return (
    <div className="flex flex-col">
      <div className="space-y-2 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">
            {subject}
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
          ) : location ? (
            <span className="font-medium">{location}</span>
          ) : (
            <span className="text-muted-foreground">Not specified</span>
          )}
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
      </dl>

      {actionError && (
        <p className="px-4 pb-2 text-xs text-destructive">{actionError}</p>
      )}

      {!isCancelled && (
        <div className="flex flex-wrap items-center gap-2 border-t p-3">
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
          <Button size="sm" variant="ghost" asChild className="ml-auto">
            <Link to={`/lessons/${lessonId}`}>Open</Link>
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
