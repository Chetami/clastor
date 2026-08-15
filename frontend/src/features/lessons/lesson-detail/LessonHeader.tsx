import {
  Ban,
  Calendar,
  CalendarClock,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Repeat,
  Video,
} from "lucide-react";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";
import type { LessonResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmailGuard } from "@/components/email-guard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import {
  ACCEPTANCE_LABELS,
  isLessonFinished,
  lessonEndDate,
  formatMsRemaining,
  formatLessonDateTime,
  formatLessonTime,
} from "@/features/schedule/lesson-utils";
import { lessonBadge } from "@/features/lessons/lesson-display";

interface LessonHeaderProps {
  lesson: LessonResponse;
  studentName: string;
  /** Student's contact email. When absent the Notify button is disabled. */
  studentEmail?: string | null;
  googleConnected: boolean | null;
  onNotify: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onResync: () => void;
  notifyPending: boolean;
  resyncPending: boolean;
}

/**
 * The lesson title card: subject + student, status badge, schedule summary,
 * student-response state, and the contextual action buttons (notify /
 * reschedule / cancel / Google Calendar sync / join meet).
 */
export function LessonHeader({
  lesson,
  studentName,
  studentEmail,
  googleConnected,
  onNotify,
  onReschedule,
  onCancel,
  onResync,
  notifyPending,
  resyncPending,
}: LessonHeaderProps) {
  const subject = lesson.subject;
  const existingMeet = lesson.meetLink;
  const end = lessonEndDate(lesson);
  const badge = lessonBadge(lesson);
  const lessonFinished = isLessonFinished(lesson);
  const canManage = !lesson.isCancelled && !lessonFinished;
  const showOverflow = canManage || (!lesson.isCancelled && googleConnected);

  // Keep the cooldown countdown ticking while the page is open.
  const now = useNow();

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt ? now < nextAllowedAt.getTime() : false;
  const cooldownRemaining = cooldownActive
    ? formatMsRemaining(nextAllowedAt!.getTime() - now)
    : "";

  return (
    <Card className="overflow-hidden">
      <CardContent>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {subject ? `${subject} — ${studentName}` : studentName}
              </h1>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  badge.tone,
                )}
              >
                {badge.label}
              </span>
              {lesson.seriesId && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Repeat className="h-3 w-3" />
                  Recurring
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatLessonDateTime(lesson.startDateTime)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatLessonTime(lesson.startDateTime)}–
                {formatLessonTime(end.toISOString())} ({lesson.durationMinutes}{" "}
                min)
              </span>
              {existingMeet ? (
                <a
                  href={existingMeet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Video className="h-3.5 w-3.5" />
                  Google Meet
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : lesson.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {lesson.location}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
              <span>
                Student response:{" "}
                <span
                  className={cn(
                    "font-medium",
                    lesson.acceptanceStatus === "accepted"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : lesson.acceptanceStatus === "declined"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {ACCEPTANCE_LABELS[lesson.acceptanceStatus]}
                </span>
              </span>
              {notifiedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    Last reminded{" "}
                    {notifiedAt.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Contextual actions */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {existingMeet && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={existingMeet}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="h-4 w-4" />
                  Join Meet
                </a>
              </Button>
            )}
            {canManage && (
              <>
                <EmailGuard hasEmail={!!studentEmail?.trim()}>
                  <Button
                    size="sm"
                    onClick={onNotify}
                    disabled={cooldownActive}
                    title={
                      cooldownActive && nextAllowedAt
                        ? `Already notified — resend in ${cooldownRemaining}`
                        : "Send a reminder email to the student"
                    }
                  >
                    {notifyPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {notifiedAt ? "Notify again" : "Notify student"}
                  </Button>
                </EmailGuard>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReschedule}
                  title="Move this lesson to a new time"
                >
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </Button>
              </>
            )}
            {showOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canManage && (
                    <DropdownMenuItem
                      onClick={onCancel}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Cancel lesson
                    </DropdownMenuItem>
                  )}
                  {googleConnected && !lesson.isCancelled && (
                    <DropdownMenuItem
                      onClick={onResync}
                      disabled={resyncPending}
                    >
                      {resyncPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {lesson.googleCalendarEventId
                        ? "Resync to Google Calendar"
                        : "Add to Google Calendar"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
