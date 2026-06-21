import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  StickyNote,
  User,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Repeat,
  Ban,
  Mail,
  Video,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useGetLesson,
  useRecordAttendance,
  useCancelLesson,
  useNotifyStudent,
  useUpdateLesson,
} from "../schedule/api";
import {
  generateMeetLinkRequest,
  getGoogleConnectionStatus,
  getGoogleAuthUrl,
} from "../schedule/api/requests";
import { useListStudents } from "@/features/students/api";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  deriveLessonStatus,
  isLessonFinished,
  lessonEndDate,
} from "../schedule/lesson-utils";
import type { AttendanceStatus } from "@examify-tms/interfaces";
import { meetUrl } from "@/features/lessons/lesson-display";

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

const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-muted text-muted-foreground",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

/** Mirrors the backend NOTIFY_COOLDOWN_MS default (24h). Used for the
 *  optimistic button state; the server remains the source of truth. */
const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useGetLesson(eventId);
  const { data: students = [] } = useListStudents();
  const recordAttendance = useRecordAttendance(eventId!);
  const cancelLesson = useCancelLesson(eventId!);
  const notifyStudent = useNotifyStudent(eventId!);
  const updateLesson = useUpdateLesson(eventId!);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetError, setMeetError] = useState<string | null>(null);
  // null = unknown, true = connected, false = not connected
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  useEffect(() => {
    getGoogleConnectionStatus()
      .then((s) => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading lesson…
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Lesson not found</p>
          <p className="text-sm text-muted-foreground">
            This lesson may have been removed or is no longer on the schedule.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/lessons">
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Link>
        </Button>
      </div>
    );
  }

  const end = lessonEndDate(lesson);
  const existingMeet = meetUrl(lesson.location);
  const studentName =
    students.find((s) => s.id === lesson.studentId)?.name ?? "Unknown student";
  const status = deriveLessonStatus(
    lesson.attendanceStatus,
    lesson.isCancelled,
  );
  const lessonFinished = isLessonFinished(lesson);

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;

  const defaultNotifyMessage = (() => {
    const when = formatDateTime(lesson.startDateTime);
    return `Hi ${studentName},\n\nThis is a reminder about our upcoming ${lesson.subject} lesson on ${when}.\n\nLooking forward to seeing you!`;
  })();

  function openNotifyDialog() {
    setNotifyMessage(defaultNotifyMessage);
    setPickerError(null);
    setNotifyOpen(true);
  }

  async function handleGenerateMeet() {
    if (!eventId || !lesson) return;
    setMeetLoading(true);
    setMeetError(null);
    try {
      if (!googleConnected) {
        // Not connected yet — kick off the Google Calendar OAuth flow.
        const { authUrl } = await getGoogleAuthUrl();
        window.location.href = authUrl;
        return;
      }
      // Time the backing calendar event to this lesson's slot.
      const { meetingLink } = await generateMeetLinkRequest({
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      await updateLesson.mutateAsync({ location: meetingLink });
    } catch (err) {
      setMeetError(
        err instanceof Error ? err.message : "Failed to generate Meet link",
      );
    } finally {
      setMeetLoading(false);
    }
  }

  async function handleNotify() {
    try {
      await notifyStudent.mutateAsync(notifyMessage);
      setNotifyOpen(false);
    } catch {
      setPickerError(
        notifyStudent.error?.message ?? "Failed to notify student",
      );
      setNotifyOpen(false);
    }
  }

  async function handleAttendanceChange(value: AttendanceStatus) {
    if (!eventId) return;
    setPickerError(null);
    try {
      await recordAttendance.mutateAsync(value);
    } catch {
      setPickerError(
        recordAttendance.error?.message ?? "Failed to record attendance",
      );
    }
  }

  async function handleCancel() {
    if (!eventId) return;
    try {
      await cancelLesson.mutateAsync();
    } catch {
      setPickerError(cancelLesson.error?.message ?? "Failed to cancel lesson");
    }
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate("/lessons")}
      >
        <ArrowLeft className="h-4 w-4" />
        Lessons
      </Button>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {lesson.subject} — {studentName}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
          {lesson.seriesId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3 w-3" />
              Recurring
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {lesson.subject} session
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="When"
              value={formatDateTime(lesson.startDateTime)}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={`${formatTime(lesson.startDateTime)} – ${formatTime(
                end.toISOString(),
              )} (${lesson.durationMinutes} min)`}
            />
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="Student"
              value={studentName}
            />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">
                {existingMeet ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs text-muted-foreground">Location</p>
                {existingMeet ? (
                  <a
                    href={existingMeet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Open Google Meet
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p
                    className={
                      lesson.location
                        ? "break-words text-sm font-medium"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {lesson.location ?? "Not specified"}
                  </p>
                )}
                {!existingMeet && (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={
                        meetLoading ||
                        googleConnected === null ||
                        updateLesson.isPending
                      }
                      onClick={handleGenerateMeet}
                      title={
                        googleConnected
                          ? "Generate a Google Meet link and save it to this lesson"
                          : "Connect your Google account to generate Meet links"
                      }
                    >
                      {meetLoading || updateLesson.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">
                        {meetLoading || updateLesson.isPending
                          ? "Generating…"
                          : googleConnected
                            ? "Generate Meet link"
                            : "Connect Google"}
                      </span>
                    </Button>
                    {meetError && (
                      <p className="mt-1 text-xs text-destructive">
                        {meetError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lesson.notes ? (
              <p className="whitespace-pre-wrap text-sm">{lesson.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No notes for this lesson.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Status &amp; attendance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Student acceptance
              </p>
              <div className="flex items-center gap-2 text-sm font-medium">
                {lesson.acceptanceStatus === "accepted" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {ACCEPTANCE_LABELS[lesson.acceptanceStatus]}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Attendance / outcome
              </p>
              <select
                value={lesson.attendanceStatus}
                onChange={(e) =>
                  handleAttendanceChange(e.target.value as AttendanceStatus)
                }
                disabled={recordAttendance.isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ATTENDANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {ATTENDANCE_LABELS[opt]}
                  </option>
                ))}
              </select>
              {pickerError && (
                <p className="text-xs text-destructive">{pickerError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Reminders: {lesson.remindersEnabled ? "enabled" : "disabled"}
              </p>
            </div>

            <div className="sm:col-span-2">
              {lesson.isCancelled ? (
                <p className="text-sm text-muted-foreground">
                  This occurrence has been cancelled.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openNotifyDialog}
                    disabled={cooldownActive}
                    title={
                      cooldownActive && nextAllowedAt
                        ? `Already notified — can resend after ${nextAllowedAt.toLocaleString(
                            "en-US",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            },
                          )}`
                        : "Send a reminder email to the student"
                    }
                  >
                    <Mail className="h-4 w-4" />
                    {notifiedAt ? "Notify student again" : "Notify student"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelLesson.isPending || lessonFinished}
                    className="text-destructive hover:text-destructive"
                    title={
                      lessonFinished
                        ? "Cannot cancel finished lessons"
                        : "Cancel this occurrence"
                    }
                  >
                    <Ban className="h-4 w-4" />
                    {cancelLesson.isPending
                      ? "Cancelling…"
                      : "Cancel this occurrence"}
                  </Button>
                </div>
              )}
              {notifiedAt && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Last notified{" "}
                  {notifiedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {lesson.studentNotifiedCount
                    ? ` · ${lesson.studentNotifiedCount} sent`
                    : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
          {pickerError && (
            <p className="text-xs text-destructive">{pickerError}</p>
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
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  /** When set (e.g. a Meet URL), render the value as a clickable link. */
  href?: string | null;
}

function DetailRow({ icon, label, value, muted, href }: DetailRowProps) {
  const isMeet = !!href;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">
        {isMeet ? <Video className="h-4 w-4" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open Google Meet
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p
            className={
              muted
                ? "truncate text-sm text-muted-foreground"
                : "truncate text-sm font-medium"
            }
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
