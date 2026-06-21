import { isSameDay, format } from "date-fns";
import type { LessonResponse } from "@examify-tms/interfaces";

/** Format a number as AUD currency (matches invoice currency today). */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format hours with one decimal place, trimmed of trailing .0. */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(1))}h`;
}

/**
 * Percentage change from previous to current. Returns null when both are zero.
 * When previous is zero but current is positive, reports +100% ("new activity").
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

/** Lessons happening right now: start <= now <= end. */
export function findCurrentLesson(
  lessons: LessonResponse[],
): LessonResponse | undefined {
  const now = Date.now();
  return lessons.find((l) => {
    if (l.isCancelled) return false;
    const start = new Date(l.startDateTime).getTime();
    const end = start + l.durationMinutes * 60_000;
    return now >= start && now <= end;
  });
}

/** Today's non-cancelled lessons, sorted ascending by start time. */
export function todaysLessons(lessons: LessonResponse[]): LessonResponse[] {
  const today = new Date();
  return lessons
    .filter((l) => !l.isCancelled && isSameDay(new Date(l.startDateTime), today))
    .sort(
      (a, b) =>
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
    );
}

/** Future non-cancelled lessons, sorted ascending, capped. */
export function upcomingLessons(
  lessons: LessonResponse[],
  limit = 10,
): LessonResponse[] {
  const now = Date.now();
  return lessons
    .filter((l) => !l.isCancelled && new Date(l.startDateTime).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
    )
    .slice(0, limit);
}

/**
 * Past, non-cancelled lessons whose attendance is still unrecorded — the
 * "things to do". Sorted most-recent first so freshly-finished lessons surface.
 */
export function todoLessons(
  lessons: LessonResponse[],
  limit = 8,
): LessonResponse[] {
  const now = Date.now();
  return lessons
    .filter(
      (l) =>
        !l.isCancelled &&
        l.attendanceStatus === "unrecorded" &&
        new Date(l.startDateTime).getTime() < now,
    )
    .sort(
      (a, b) =>
        new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime(),
    )
    .slice(0, limit);
}

/** "09:00 – 10:00" style range for a lesson. */
export function lessonTimeRange(lesson: LessonResponse): string {
  const start = new Date(lesson.startDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  return `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;
}

/** Compact relative day label, e.g. "Today", "Tomorrow", "Mon 24". */
export function relativeDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return format(date, "EEE d MMM");
}
