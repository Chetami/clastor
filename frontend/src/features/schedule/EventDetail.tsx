import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetLesson, useRecordAttendance, useCancelLesson } from "./api";
import { useListStudents } from "@/features/students/api";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  deriveLessonStatus,
  lessonEndDate,
} from "./lesson-utils";
import type { AttendanceStatus } from "@examify-tms/interfaces";

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

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useGetLesson(eventId);
  const { data: students = [] } = useListStudents();
  const recordAttendance = useRecordAttendance(eventId!);
  const cancelLesson = useCancelLesson(eventId!);
  const [pickerError, setPickerError] = useState<string | null>(null);

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
          <Link to="/schedule">
            <ArrowLeft className="h-4 w-4" />
            Back to Schedule
          </Link>
        </Button>
      </div>
    );
  }

  const end = lessonEndDate(lesson);
  const studentName =
    students.find((s) => s.id === lesson.studentId)?.name ?? "Unknown student";
  const status = deriveLessonStatus(
    lesson.attendanceStatus,
    lesson.isCancelled,
  );

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
      setPickerError(
        cancelLesson.error?.message ?? "Failed to cancel lesson",
      );
    }
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate("/schedule")}
      >
        <ArrowLeft className="h-4 w-4" />
        Schedule
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
        <p className="text-sm text-muted-foreground">{lesson.subject} session</p>
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
            <DetailRow
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={lesson.location ?? "Not specified"}
              muted={!lesson.location}
            />
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelLesson.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Ban className="h-4 w-4" />
                  {cancelLesson.isPending ? "Cancelling…" : "Cancel this occurrence"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

function DetailRow({ icon, label, value, muted }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            muted
              ? "truncate text-sm text-muted-foreground"
              : "truncate text-sm font-medium"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
