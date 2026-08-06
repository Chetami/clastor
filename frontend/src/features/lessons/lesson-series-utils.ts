import { compareAsc, format, parse } from "date-fns";
import type {
  DayOfWeek,
  LessonResponse,
  LessonSlot,
} from "@examify-tms/interfaces";

export const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** Tailwind tone classes for a series' acceptance-status badge. */
export const ACCEPTANCE_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  declined: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

/** Format a recurring slot like "Mon 7:30 PM". */
export function formatSlot(slot: LessonSlot): string {
  const time = format(parse(slot.timeOfDay, "HH:mm", new Date()), "h:mm a");
  return `${DAY_SHORT[slot.dayOfWeek]} ${time}`;
}

/** Format an optional end-bounded date range, e.g. "Jan 5, 2026 – Mar 30, 2026". */
export function formatRange(startDate: string, until: string | null): string {
  try {
    const fmt = (iso: string) =>
      format(new Date(iso + "T00:00:00"), "MMM d, yyyy");
    return until
      ? `${fmt(startDate)} – ${fmt(until)}`
      : `from ${fmt(startDate)}`;
  } catch {
    return startDate;
  }
}

export type LessonIssue =
  /** Past lesson whose attendance is still "unrecorded". */
  | { kind: "attendance"; label: "Attendance not recorded" }
  /** Past lesson with no invoice opened yet (still needs invoicing). */
  | { kind: "unpaid"; label: "Unpaid" };

/**
 * Issues that need the tutor's attention for a given past lesson, each
 * carrying a `kind` so callers can render a matching quick action (e.g.
 * open the attendance dialog, deep-link into Create Invoice).
 */
export function lessonIssues(lesson: LessonResponse): LessonIssue[] {
  const issues: LessonIssue[] = [];
  const future = new Date(lesson.startDateTime).getTime() >= Date.now();
  if (lesson.isCancelled || future) return issues;
  if (lesson.attendanceStatus === "unrecorded") {
    issues.push({ kind: "attendance", label: "Attendance not recorded" });
  }
  // Only surface the "Create invoice" nudge when no invoice has been opened
  // for this lesson yet — once an invoice exists (even unpaid), payment is
  // tracked on the invoice, not as a lesson issue.
  if (!lesson.invoiceId && !lesson.isPaid) {
    issues.push({ kind: "unpaid", label: "Unpaid" });
  }
  return issues;
}

export interface LessonMonthGroup {
  key: string;
  label: string;
  lessons: LessonResponse[];
}

/** Group lessons into chronological month buckets with a human label. */
export function groupLessonsByMonth(lessons: LessonResponse[]): LessonMonthGroup[] {
  const sorted = [...lessons].sort((a, b) =>
    compareAsc(new Date(a.startDateTime), new Date(b.startDateTime)),
  );
  const groups: LessonMonthGroup[] = [];
  for (const lesson of sorted) {
    const d = new Date(lesson.startDateTime);
    const key = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy");
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  return groups;
}
