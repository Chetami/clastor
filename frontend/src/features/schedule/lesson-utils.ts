import type {
  AttendanceStatus,
  LessonAcceptance,
  LessonResponse,
} from "@examify-tms/interfaces";

/**
 * Derived lifecycle status computed from isCancelled + attendanceStatus
 * (not stored on the lesson).
 */
export type DerivedLessonStatus = "scheduled" | "completed" | "cancelled";

export function deriveLessonStatus(
  attendance: AttendanceStatus,
  isCancelled = false,
): DerivedLessonStatus {
  if (isCancelled) {
    return "cancelled";
  }
  if (
    attendance === "tutor_cancelled" ||
    attendance === "tutor_cancelled_makeup_issued"
  ) {
    return "cancelled";
  }
  if (attendance === "unrecorded") {
    return "scheduled";
  }
  return "completed";
}

/** Compute the end Date of a lesson from start + duration. */
export function lessonEndDate(lesson: LessonResponse): Date {
  return new Date(
    new Date(lesson.startDateTime).getTime() +
      lesson.durationMinutes * 60_000,
  );
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  unrecorded: "Unrecorded",
  present: "Present",
  present_late: "Present (late)",
  absent_no_makeup: "Absent — no make-up credit",
  absent_makeup_issued: "Absent — make-up credit issued",
  absent_warning: "Absent — warning issued",
  tutor_cancelled: "Tutor cancelled",
  tutor_cancelled_makeup_issued: "Tutor cancelled — make-up credit issued",
};

export const ACCEPTANCE_LABELS: Record<LessonAcceptance, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

/** Ordered options for an attendance picker UI. */
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = [
  "unrecorded",
  "present",
  "present_late",
  "absent_no_makeup",
  "absent_makeup_issued",
  "absent_warning",
  "tutor_cancelled",
  "tutor_cancelled_makeup_issued",
];

/** Tailwind tone classes for an attendance badge. */
export function attendanceTone(
  status: AttendanceStatus,
  isCancelled = false,
): string {
  if (isCancelled || status === "tutor_cancelled" || status === "tutor_cancelled_makeup_issued") {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  }
  switch (status) {
    case "present":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "present_late":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "absent_no_makeup":
    case "absent_warning":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    case "absent_makeup_issued":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export interface FullCalendarLessonEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    studentId: string;
    studentName?: string;
    subject: string;
    attendance: AttendanceStatus;
    acceptance: LessonAcceptance;
    status: DerivedLessonStatus;
  };
}

/**
 * Map a LessonResponse to a FullCalendar event, joining in an optional
 * student name (looked up from a studentId -> name map).
 */
export function lessonToCalendarEvent(
  lesson: LessonResponse,
  studentNames?: Record<string, string>,
): FullCalendarLessonEvent {
  const start = lesson.startDateTime;
  const end = lessonEndDate(lesson).toISOString();
  const studentName = studentNames?.[lesson.studentId];
  return {
    id: lesson.id,
    title: studentName
      ? `${lesson.subject} — ${studentName}`
      : lesson.subject,
    start,
    end,
    extendedProps: {
      studentId: lesson.studentId,
      studentName,
      subject: lesson.subject,
      attendance: lesson.attendanceStatus,
      acceptance: lesson.acceptanceStatus,
      status: deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled),
    },
  };
}
