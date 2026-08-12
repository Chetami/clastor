import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useGetLesson,
  useRecordAttendance,
  useCancelLesson,
  useNotifyStudent,
  useUpdateLesson,
  useResyncLesson,
  previewNotifyStudentRequest,
} from "../schedule/api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { getGoogleConnectionStatus } from "../schedule/api/requests";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import type { AttendanceStatus } from "@examify-tms/interfaces";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";
import { CancelLessonDialog } from "@/features/schedule/CancelLessonDialog";
import { LessonHeader } from "./lesson-detail/LessonHeader";
import { LessonDetailsCard } from "./lesson-detail/LessonDetailsCard";
import { LessonNotesCard } from "./lesson-detail/LessonNotesCard";
import { LessonChecklist } from "./lesson-detail/LessonChecklist";
import { LessonOutcome } from "./lesson-detail/LessonOutcome";

/**
 * Lesson detail page — a slim orchestrator. The data layer + mutations live
 * here; each card (header / details / notes / checklist / outcome) and its
 * interactions are extracted into `./lesson-detail/` sub-components.
 */
export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useGetLesson(eventId);
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const recordAttendance = useRecordAttendance(eventId!);
  const cancelLesson = useCancelLesson(eventId!);
  const notifyStudent = useNotifyStudent(eventId!);
  const updateLesson = useUpdateLesson(eventId!);
  const resyncLesson = useResyncLesson(eventId!);

  const [pickerError, setPickerError] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

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

  const student = students.find((s) => s.id === lesson.studentId);
  const studentName = student?.name ?? "Unknown student";
  const studentSubjects = student
    ? subjects.filter((s) => student.subjectIds?.includes(s.id))
    : [];

  function openNotifyDialog() {
    setPickerError(null);
    setNotifyOpen(true);
  }

  async function handleNotify(message: string) {
    try {
      await notifyStudent.mutateAsync({ message: message || undefined });
      toast.success("Reminder sent");
      setNotifyOpen(false);
    } catch {
      setPickerError(
        notifyStudent.error?.message ?? "Failed to notify student",
      );
      setNotifyOpen(false);
    }
  }

  async function handleAttendanceChange(value: AttendanceStatus) {
    setPickerError(null);
    try {
      await recordAttendance.mutateAsync(value);
    } catch {
      setPickerError(
        recordAttendance.error?.message ?? "Failed to record attendance",
      );
    }
  }

  function handleCancel() {
    if (!lesson) return;
    // Always confirm before cancelling — even one-off pending lessons — to
    // avoid a destructive one-click action. The dialog owns the cancel flow
    // (notify checkbox, series scope, email review).
    setCancelOpen(true);
  }

  async function handleResync() {
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
      toast.error(
        resyncLesson.error?.message ?? "Failed to sync to Google Calendar",
      );
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

      <LessonHeader
        lesson={lesson}
        studentName={studentName}
        studentEmail={student?.email ?? null}
        googleConnected={googleConnected}
        onNotify={openNotifyDialog}
        onReschedule={() => setRescheduleOpen(true)}
        onCancel={handleCancel}
        onResync={handleResync}
        notifyPending={notifyStudent.isPending}
        cancelPending={cancelLesson.isPending}
        resyncPending={resyncLesson.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LessonDetailsCard
            lesson={lesson}
            studentName={studentName}
            studentSubjects={studentSubjects}
            updateLesson={updateLesson}
            googleConnected={googleConnected}
          />
          <LessonNotesCard
            eventId={eventId}
            lesson={lesson}
            updateLesson={updateLesson}
          />
          <LessonChecklist
            eventId={eventId}
            lesson={lesson}
            updateLesson={updateLesson}
          />
        </div>

        <div className="space-y-6 lg:col-span-1">
          <LessonOutcome
            lesson={lesson}
            googleConnected={googleConnected}
            pickerError={pickerError}
            recordAttendancePending={recordAttendance.isPending}
            resyncPending={resyncLesson.isPending}
            onAttendanceChange={handleAttendanceChange}
            onResync={handleResync}
          />
        </div>
      </div>

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

      <RescheduleDialog
        lesson={lesson}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />

      <CancelLessonDialog
        lesson={lesson}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </div>
  );
}
