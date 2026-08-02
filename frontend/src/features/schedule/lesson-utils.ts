import type {
  AttendanceStatus,
  LessonAcceptance,
  LessonResponse,
  ExternalCalendarEvent,
} from "@examify-tms/interfaces";
import {
  deriveLessonStatus,
  lessonEndDate,
  type DerivedLessonStatus,
} from "@examify-tms/shared";

// Pure lesson domain logic lives in @examify-tms/shared — re-exported here so
// existing imports from this module keep working.
export {
  deriveLessonStatus,
  lessonEndDate,
  isLessonFinished,
  isRangeOverlap,
  isUpcomingLesson,
  isToday,
  ATTENDANCE_LABELS,
  ACCEPTANCE_LABELS,
  ATTENDANCE_OPTIONS,
  STUDENT_NOTIFY_COOLDOWN_MS,
  INVOICE_RESEND_COOLDOWN_MS,
  formatMsRemaining,
  formatLessonDate,
  formatLessonTime,
  type DerivedLessonStatus,
} from "@examify-tms/shared";

// --- UI-specific helpers (Tailwind tokens + FullCalendar shapes) stay here ---

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
