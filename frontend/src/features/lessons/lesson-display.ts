import type { LessonResponse } from "@examify-tms/interfaces";
import {
  ATTENDANCE_LABELS,
  attendanceTone,
  deriveLessonStatus,
} from "@/features/schedule/lesson-utils";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatLessonDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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
