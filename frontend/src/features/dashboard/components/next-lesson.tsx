import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  Video,
  ExternalLink,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse } from "@examify-tms/interfaces";
import { useGenerateMeetLink } from "../api";
import {
  useUpdateLesson,
  useNotifyStudent,
  previewNotifyStudentRequest,
} from "@/features/schedule/api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { EmailGuard } from "@/components/email-guard";
import { lessonTimeRange, relativeDayLabel, timeUntil } from "../lib";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";

type Props = {
  lesson: LessonResponse | undefined;
  studentName: string;
  /** Student's contact email. When absent the Notify button is disabled. */
  studentEmail?: string | null;
};

export function NextLesson({ lesson, studentName, studentEmail }: Props) {
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

  const callLink = lesson.meetLink;
  const isMeet = !!lesson.meetLink;

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
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
      await updateLesson.mutateAsync({
        location: "Google Meet",
        meetLink: res.meetingLink,
      });
      toast.success("Google Meet link created");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Connect your Google account to generate Meet links",
      );
    }
  };

  const handleNotify = async (message: string) => {
    await notifyStudent.mutateAsync({
      message: message || undefined,
    });
    toast.success("Reminder sent");
  };

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 ">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Next lesson</CardTitle>
      </CardHeader>
      <CardContent>
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
              {relativeDayLabel(lesson.startDateTime)} ·{" "}
              {lessonTimeRange(lesson)}
            </p>
            <p className="text-sm font-medium">
              {studentName} · {lesson.subject}
            </p>
          </Link>

          {/* Open the call when a link exists; otherwise offer to generate a Meet */}
          {callLink ? (
            <Button asChild size="lg" className="shrink-0 gap-1.5">
              <a href={callLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
                {isMeet ? "Join Meet" : "Join call"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : (
            <Button
              size="lg"
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
          <EmailGuard hasEmail={!!studentEmail?.trim()}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setNotifyOpen(true)}
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
          </EmailGuard>
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

      <EmailComposeDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        title={`Notify ${studentName}`}
        description="Send a reminder email to the student. You can resend once every 24 hours."
        fetchPreview={(message) =>
          previewNotifyStudentRequest(lesson.id, message)
        }
        onSend={handleNotify}
      />
    </Card>
  );
}
