import type {
  AttendanceStatus,
  LessonAcceptance,
  LessonResponse,
  ExternalCalendarEvent,
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

/**
 * Check if a lesson is finished (cannot be cancelled).
 * A lesson is finished if:
 * 1. It has a recorded attendance status (not "unrecorded")
 * 2. Or its end time has passed
 */
export function isLessonFinished(lesson: LessonResponse): boolean {
  const hasRecordedAttendance = lesson.attendanceStatus !== "unrecorded";
  const endTime = new Date(
    new Date(lesson.startDateTime).getTime() +
      lesson.durationMinutes * 60_000,
  );
  const isPastEndTime = endTime < new Date();
  return hasRecordedAttendance || isPastEndTime;
}

export interface FullCalendarLessonEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    studentId: string;
    studentName?: string;
    subject: string | null | undefined;
    attendance: AttendanceStatus;
    acceptance: LessonAcceptance;
    status: DerivedLessonStatus;
    seriesId: string | null;
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
  const titleParts = [lesson.subject, studentName].filter(Boolean);
  const title = titleParts.join(" — ") || "Lesson";
  return {
    id: lesson.id,
    title,
    start,
    end,
    extendedProps: {
      studentId: lesson.studentId,
      studentName,
      subject: lesson.subject,
      attendance: lesson.attendanceStatus,
      acceptance: lesson.acceptanceStatus,
      status: deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled),
      seriesId: lesson.seriesId ?? null,
    },
  };
}

/** A FullCalendar event representing an external (non-lesson) Google event. */
export interface FullCalendarExternalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    kind: "external";
    location: string | null;
  };
}

/**
 * Map an ExternalCalendarEvent to a FullCalendar event tagged as external so
 * the calendar can render + treat it distinctly (muted, read-only).
 */
export function externalEventToCalendarEvent(
  event: ExternalCalendarEvent,
): FullCalendarExternalEvent {
  return {
    id: `ext:${event.id}`,
    title: event.title,
    start: event.startDateTime,
    end: event.endDateTime,
    extendedProps: {
      kind: "external",
      location: event.location ?? null,
    },
  };
}

/**
 * True if the [startA, endA) range overlaps [startB, endB). Touching edges
 * (endA === startB) do not count as an overlap.
 */
export function isRangeOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && sB < eA;
}
