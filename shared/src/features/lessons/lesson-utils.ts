import {
  addMinutes,
  intervalToDuration,
  isPast,
  isToday as isTodayDateFns,
} from "date-fns";
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
  return addMinutes(new Date(lesson.startDateTime), lesson.durationMinutes);
}

/** True when a lesson is in the future (start time hasn't arrived yet). */
export function isUpcomingLesson(lesson: LessonResponse): boolean {
  return !isPast(new Date(lesson.startDateTime));
}

/**
 * Check if a lesson is finished (cannot be cancelled).
 * A lesson is finished if:
 * 1. It has a recorded attendance status (not "unrecorded")
 * 2. Or its end time has passed
 */
export function isLessonFinished(lesson: LessonResponse): boolean {
  const hasRecordedAttendance = lesson.attendanceStatus !== "unrecorded";
  const isPastEndTime = isPast(lessonEndDate(lesson));
  return hasRecordedAttendance || isPastEndTime;
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

/** True when the given date is in the same calendar day (local) as now. */
export function isToday(date: Date): boolean {
  return isTodayDateFns(date);
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

/* -------------------------------------------------------------------------- */
/* Backend-mirrored cooldowns.                                                */
/* Both default to 24h today; kept as two distinct constants because the      */
/* backend treats them as two separate env vars (NOTIFY_COOLDOWN_MS and       */
/* INVOICE_RESEND_COOLDOWN_MS). The backend remains authoritative — these     */
/* only drive proactive client UI lockout/countdowns.                          */
/* -------------------------------------------------------------------------- */

/** Mirrors the backend NOTIFY_COOLDOWN_MS default (24h). */
export const STUDENT_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Mirrors the backend INVOICE_RESEND_COOLDOWN_MS default (24h). */
export const INVOICE_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Compact countdown label for a millisecond duration: "Xh Ym" / "Xh" / "Ym".
 * Decomposes the duration with date-fns (flooring each unit) and folds days
 * into hours so a 24h cooldown reads "24h" rather than "1 day" — and never
 * shows a stray extra minute from sub-minute remainder.
 */
export function formatMsRemaining(ms: number): string {
  if (ms <= 0) return "";
  const d = intervalToDuration({ start: new Date(0), end: new Date(ms) });
  const totalHours = (d.days ?? 0) * 24 + (d.hours ?? 0);
  const minutes = d.minutes ?? 0;
  if (totalHours > 0)
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  return `${minutes}m`;
}

/* -------------------------------------------------------------------------- */
/* Lesson date/time formatters (en-AU, to match the rest of the app).         */
/* -------------------------------------------------------------------------- */

/** Formats an ISO date as "Mon, 5 Jan". */
export function formatLessonDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Formats an ISO date as "5:30 pm". */
export function formatLessonTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}
