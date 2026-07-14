import type { LessonResponse } from "@examify-tms/interfaces";
import {
  ATTENDANCE_LABELS,
  attendanceTone,
  deriveLessonStatus,
} from "@/features/schedule/lesson-utils";

/** Up to two uppercase initials from a full name. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Formats an ISO date as "Mon, Jan 5". */
export function formatLessonDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Formats an ISO date as "5:30 PM". */
export function formatLessonTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface LessonBadge {
  label: string;
  tone: string;
}

/** Derives the badge label and tone for a lesson based on status and timing. */
export function lessonBadge(lesson: LessonResponse): LessonBadge {
  const status = deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled);
  const future = new Date(lesson.startDateTime).getTime() >= Date.now();
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
  if (lesson.attendanceStatus === "tutor_cancelled") {
    return {
      label: "Tutor cancelled",
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    };
  }
  if (lesson.attendanceStatus === "tutor_cancelled_makeup_issued") {
    return {
      label: "Tutor cancelled — credited",
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: ATTENDANCE_LABELS[lesson.attendanceStatus],
    tone: attendanceTone(lesson.attendanceStatus),
  };
}

/** True when the given date is in the same calendar day (local) as now. */
export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
