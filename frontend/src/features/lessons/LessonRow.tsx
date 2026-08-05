import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import {
  useMarkLessonDone,
  useUpdateLessonDetails,
} from "@/features/dashboard/api";
import {
  useInvoiceLesson,
  type InvoiceLessonEdits,
} from "@/features/payments/api";
import { CancelLessonDialog } from "@/features/schedule/CancelLessonDialog";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";
import {
  formatLessonTime,
  isToday,
  lessonBadge,
} from "@/features/lessons/lesson-display";
import { lessonIssues, ACCEPTANCE_TONE } from "./lesson-series-utils";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "present",
  present_late: "late",
  absent_no_makeup: "absent",
  absent_makeup_issued: "absent (makeup issued)",
  absent_warning: "absent (warning)",
  tutor_cancelled: "tutor cancelled",
  tutor_cancelled_makeup_issued: "tutor cancelled (makeup issued)",
  unrecorded: "unrecorded",
};

export interface LessonRowProps {
  lesson: LessonResponse;
}

/** A single lesson row in the series list. */
export function LessonRow({ lesson }: LessonRowProps) {
  const navigate = useNavigate();
  const start = new Date(lesson.startDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  const issues = lessonIssues(lesson);
  const hasAttendanceIssue = issues.some((i) => i.kind === "attendance");
  const hasUnpaidIssue = issues.some((i) => i.kind === "unpaid");

  // Derive the status badge. "Upcoming" is obvious from the date, so for
  // future lessons we surface acceptance instead — only when pending or
  // declined (accepted is the unremarkable default). Attendance-driven
  // labels (Present, Absent, Cancelled, …) are kept for past lessons.
  const baseBadge = lessonBadge(lesson);
  const statusBadge =
    baseBadge.label === "Upcoming"
      ? lesson.acceptanceStatus === "pending"
        ? { label: "Pending", tone: ACCEPTANCE_TONE.pending }
        : lesson.acceptanceStatus === "declined"
          ? { label: "Declined", tone: ACCEPTANCE_TONE.declined }
          : null
      : baseBadge;

  const dayOfMonth = start.getDate();
  const weekdayShort = start
    .toLocaleDateString("en-AU", { weekday: "short" })
    .toUpperCase();
  const today = isToday(start);

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  // Student + subject lookups power the attendance dialog (name, allowed
  // subjects). React Query dedupes these across every row, so only one
  // request fires for the whole list.
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const markDone = useMarkLessonDone();
  const updateLessonDetails = useUpdateLessonDetails();
  const invoiceLesson = useInvoiceLesson();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const studentById = useMemo(() => {
    const map: Record<string, (typeof students)[number]> = {};
    for (const s of students) map[s.id] = s;
    return map;
  }, [students]);

  const subjectOptions = useMemo(() => {
    const ids = studentById[lesson.studentId]?.subjectIds ?? [];
    return ids
      .map((id) => subjects.find((s) => s.id === id)?.name)
      .filter((n): n is string => !!n);
  }, [studentById, lesson.studentId, subjects]);

  // Mirrors ActionableLessons' flow so the attendance dialog behaves the
  // same everywhere: mark done → apply edits → optionally invoice + send.
  const attendancePending =
    markDone.isPending || updateLessonDetails.isPending || invoiceLesson.isPending;

  async function handleAttendanceConfirm(
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) {
    const name = studentNames[lesson.studentId] ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id: lessonId, attendanceStatus });

      const hasEdits =
        edits &&
        (edits.subject !== undefined || edits.durationMinutes !== undefined);
      let effective = lesson;
      if (hasEdits) {
        const data: UpdateLessonRequest = {};
        if (edits!.subject !== undefined) data.subject = edits!.subject;
        if (edits!.durationMinutes !== undefined) {
          data.durationMinutes = edits!.durationMinutes;
        }
        effective = await updateLessonDetails.mutateAsync({
          id: lessonId,
          data,
        });
      }

      if (shouldInvoice) {
        const student = studentById[lesson.studentId];
        if (student) {
          const created = await invoiceLesson.mutateAsync({
            lesson: effective,
            rateType: student.rateType,
            expectedAmount: student.expectedAmount,
          });
          toast.success(`Invoice sent to ${name}`);
          navigate(`/payments/${created.id}`);
          return;
        }
      }

      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
  }

  const cancelled = !!lesson.isCancelled;
  const isFinished = end.getTime() < Date.now();
  const dimmed = cancelled || isFinished;
  const destructiveDisabled = cancelled || isFinished;

  return (
    <div
      data-lesson-id={lesson.id}
      className="group flex items-center gap-3 scroll-mt-16 px-4 py-2.5 transition-colors hover:bg-accent/40 sm:gap-4"
    >
      <Link
        to={`/lessons/${lesson.id}`}
        className={`flex min-w-0 flex-1 items-center gap-3 transition-opacity sm:gap-4 ${
          dimmed ? "opacity-55" : ""
        }`}
      >
        {/* Date indicator — mirrors the FullCalendar day header */}
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5">
          <span
            className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center px-2 text-lg font-medium leading-none transition-colors ${
              today
                ? "rounded-full bg-primary text-primary-foreground"
                : "text-foreground"
            }`}
          >
            {dayOfMonth}
          </span>
          <span className="text-[0.6875rem] font-medium uppercase leading-none tracking-[0.04em] text-muted-foreground">
            {weekdayShort}
          </span>
        </div>

        {/* Event details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {lesson.subject ?? "Lesson"}
            </span>
            {issues.length === 0 && statusBadge ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.tone}`}
              >
                {statusBadge.label}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatLessonTime(start)} – {formatLessonTime(end)}
            </span>
          </div>
        </div>
      </Link>

      {/* Action controls */}
      <div className="flex shrink-0 items-center gap-0.5">
        {/* Issue actions — solid warning colours so they stand out against
         * the dimmed past-lesson row and never read as disabled. */}
        {(hasAttendanceIssue || hasUnpaidIssue) && (
          <div className="flex items-center gap-2">
            {hasAttendanceIssue && (
              <Button
                size="sm"
                className="h-7 gap-1 bg-rose-500 px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-600"
                onClick={() => setAttendanceOpen(true)}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Mark attendance
              </Button>
            )}
            {hasUnpaidIssue && (
              <Button
                size="sm"
                className="h-7 gap-1 bg-amber-500 px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-600"
                onClick={() =>
                  navigate(
                    `/payments/new?student=${lesson.studentId}&lesson=${lesson.id}`,
                  )
                }
              >
                <FileText className="h-3.5 w-3.5" />
                Create invoice
              </Button>
            )}
          </div>
        )}
        {(hasAttendanceIssue || hasUnpaidIssue) && (
          <span className="mx-1 h-5 w-px bg-border" />
        )}

        {!destructiveDisabled && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              title="Reschedule"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Cancel lesson"
              onClick={() => setCancelOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <RescheduleDialog
        lesson={lesson}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <CancelLessonDialog
        lesson={lesson}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
      {hasAttendanceIssue && (
        <MarkAttendanceDialog
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
          lesson={lesson}
          studentName={studentNames[lesson.studentId] ?? "Unknown student"}
          subjectOptions={subjectOptions}
          onConfirm={handleAttendanceConfirm}
          isPending={attendancePending}
        />
      )}
    </div>
  );
}
