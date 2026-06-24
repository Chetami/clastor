import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, Video, ExternalLink, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse } from "@examify-tms/interfaces";
import { useGenerateMeetLink } from "../api";
import { useUpdateLesson, useNotifyStudent } from "@/features/schedule/api";
import {
  lessonTimeRange,
  relativeDayLabel,
  timeUntil,
  extractCallLink,
  isGoogleMeet,
} from "../lib";

/** Mirrors the backend NOTIFY_COOLDOWN_MS default (24h). The server remains the
 *  source of truth; this only drives the optimistic button state. */
const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type Props = {
  lesson: LessonResponse | undefined;
  studentName: string;
};

export function NextLesson({ lesson, studentName }: Props) {
  // Re-render every 30s so the countdown stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const generateMeet = useGenerateMeetLink();
  const updateLesson = useUpdateLesson(lesson?.id ?? "");
  const notifyStudent = useNotifyStudent(lesson?.id ?? "");

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyError, setNotifyError] = useState<string | null>(null);

  if (!lesson) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Next lesson</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="py-2 text-sm text-muted-foreground">
            No upcoming lessons scheduled.
          </p>
        </CardContent>
      </Card>
    );
  }

  const callLink = extractCallLink(lesson.location);
  const isMeet = callLink ? isGoogleMeet(callLink) : false;

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;

  const handleGenerate = async () => {
    try {
      const res = await generateMeet.mutateAsync({
        lessonId: lesson.id,
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      // Persist the link to the lesson so the button becomes "Join Meet" on
      // the next render and the calendar/schedule can display it too. We don't
      // auto-open the room — the user can join via the "Join Meet" button.
      await updateLesson.mutateAsync({ location: res.meetingLink });
      toast.success("Google Meet link created");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Connect your Google account to generate Meet links",
      );
    }
  };

  const openNotifyDialog = () => {
    setNotifyError(null);
    setNotifyMessage(
      `Hi ${studentName},\n\nThis is a reminder about our upcoming ${lesson.subject} lesson on ${lessonTimeRange(lesson)} (${relativeDayLabel(lesson.startDateTime)}).\n\nLooking forward to seeing you!`,
    );
    setNotifyOpen(true);
  };

  const handleNotify = async () => {
    setNotifyError(null);
    try {
      await notifyStudent.mutateAsync(notifyMessage || undefined);
      setNotifyOpen(false);
      toast.success("Reminder sent");
    } catch (err) {
      setNotifyError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to notify student",
      );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Next lesson</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          {/* Clickable summary → lesson detail (replaces the old "View lesson" link) */}
          <Link
            to={`/lessons/${lesson.id}`}
            className="min-w-0 space-y-1 rounded-md transition-opacity hover:opacity-80"
          >
            <p className="text-2xl font-semibold leading-tight tracking-tight text-primary">
              {timeUntil(lesson.startDateTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
            </p>
            <p className="text-sm font-medium">
              {studentName} · {lesson.subject}
            </p>
          </Link>

          {/* Open the call when a link exists; otherwise offer to generate a Meet */}
          {callLink ? (
            <Button asChild size="sm" className="shrink-0 gap-1.5">
              <a href={callLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
                {isMeet ? "Join Meet" : "Join call"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1.5"
              onClick={handleGenerate}
              disabled={generateMeet.isPending || updateLesson.isPending}
            >
              {generateMeet.isPending || updateLesson.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              Generate Meet
            </Button>
          )}
        </div>

        {/* Notify the student — cooldown mirrors the lesson detail page. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openNotifyDialog}
            disabled={cooldownActive}
            title={
              cooldownActive && nextAllowedAt
                ? `Already notified — can resend after ${nextAllowedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                : "Send a reminder email to the student"
            }
          >
            <Mail className="h-4 w-4" />
            {notifiedAt ? "Notify again" : "Notify student"}
          </Button>
          {notifiedAt && (
            <span className="text-xs text-muted-foreground">
              Last notified{" "}
              {notifiedAt.toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      </CardContent>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify {studentName}</DialogTitle>
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
            <Button onClick={handleNotify} disabled={notifyStudent.isPending}>
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
    </Card>
  );
}
