import {
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";
import type { AttendanceStatus, LessonResponse } from "@examify-tms/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  formatMsRemaining,
} from "@/features/schedule/lesson-utils";
import { useNow } from "@/lib/use-now";

interface LessonOutcomeProps {
  lesson: LessonResponse;
  googleConnected: boolean | null;
  pickerError: string | null;
  recordAttendancePending: boolean;
  resyncPending: boolean;
  onAttendanceChange: (value: AttendanceStatus) => Promise<void>;
  onResync: () => void;
}

/**
 * The sticky sidebar "Outcome" card: attendance selector, notify-cooldown hint,
 * and the Google Calendar sync state/trigger.
 */
export function LessonOutcome({
  lesson,
  googleConnected,
  pickerError,
  recordAttendancePending,
  resyncPending,
  onAttendanceChange,
  onResync,
}: LessonOutcomeProps) {
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
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle className="text-base">Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {lesson.isCancelled && (
          <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            This occurrence has been cancelled.
          </p>
        )}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Attendance / outcome</p>
          <Select
            value={lesson.attendanceStatus}
            onValueChange={(v) => onAttendanceChange(v as AttendanceStatus)}
            disabled={recordAttendancePending || lesson.isCancelled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {ATTENDANCE_LABELS[opt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pickerError && (
            <p className="text-xs text-destructive">{pickerError}</p>
          )}
        </div>

        {cooldownActive && nextAllowedAt && (
          <p className="text-xs text-muted-foreground">
            Next reminder available in {cooldownRemaining} (
            {nextAllowedAt.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            ).
          </p>
        )}

        {googleConnected !== null && !lesson.isCancelled && (
          <button
            type="button"
            onClick={onResync}
            disabled={resyncPending}
            className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60 disabled:opacity-60"
            title={
              lesson.googleCalendarEventId
                ? "Update or recover the Google Calendar event"
                : "Add this lesson to your Google Calendar"
            }
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              {lesson.googleCalendarEventId ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CloudOff className="h-3.5 w-3.5 text-amber-500" />
              )}
              {lesson.googleCalendarEventId
                ? "Synced to Google Calendar"
                : "Not on Google Calendar"}
            </span>
            {resyncPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
