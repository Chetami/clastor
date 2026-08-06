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
  const [hh, mm] = slot.timeOfDay.split(":");
  const h24 = Number(hh);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${DAY_SHORT[slot.dayOfWeek]} ${h12}:${mm} ${period}`;
}

/** Format an optional end-bounded date range, e.g. "Jan 5, 2026 – Mar 30, 2026". */
export function formatRange(startDate: string, until: string | null): string {
  try {
    const start = new Date(startDate + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return until
      ? `${fmt(start)} – ${fmt(new Date(until + "T00:00:00"))}`
      : `from ${fmt(start)}`;
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
  const sorted = [...lessons].sort(
    (a, b) =>
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
  );
  const groups: LessonMonthGroup[] = [];
  for (const lesson of sorted) {
    const d = new Date(lesson.startDateTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  return groups;
}
