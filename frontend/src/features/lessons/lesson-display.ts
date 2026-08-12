import type { LessonResponse } from "@examify-tms/interfaces";
import {
  ATTENDANCE_LABELS,
  attendanceTone,
  deriveLessonStatus,
  isUpcomingLesson,
} from "@/features/schedule/lesson-utils";

// Pure helpers moved to @examify-tms/shared — re-exported here so existing
// imports from this module keep working.
export {
  getInitials,
  formatLessonDate,
  formatLessonTime,
  isToday,
} from "@examify-tms/shared";

export interface LessonBadge {
  label: string;
  tone: string;
}

/** Derives the badge label and tone for a lesson based on status and timing. */
export function lessonBadge(lesson: LessonResponse): LessonBadge {
  const status = deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled);
  const future = isUpcomingLesson(lesson);
  if (status === "cancelled") {
    return {
      label: "Cancelled",
      tone: attendanceTone(lesson.attendanceStatus, lesson.isCancelled),
    };
  }
  if (future) {
    return {
      label: "Upcoming",
      tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    };
  }
  if (lesson.attendanceStatus === "unrecorded") {
    return {
      label: "Not recorded",
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (lesson.attendanceStatus === "present") {
    return {
      label: "Present",
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (lesson.attendanceStatus === "present_late") {
    return {
      label: "Late",
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (lesson.attendanceStatus === "absent_no_makeup") {
    return {
      label: "Absent",
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    };
  }
  if (lesson.attendanceStatus === "absent_makeup_issued") {
    return {
      label: "Absent — credited",
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (lesson.attendanceStatus === "absent_warning") {
    return {
      label: "Absent — warned",
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    };
  }
  return {
    label: ATTENDANCE_LABELS[lesson.attendanceStatus],
    tone: attendanceTone(lesson.attendanceStatus),
  };
}
