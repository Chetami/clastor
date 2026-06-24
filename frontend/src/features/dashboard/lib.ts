import { isSameDay, format } from "date-fns";
import type {
  DashboardPeriod,
  DashboardSeriesPoint,
  LessonResponse,
  LessonTodo,
  StudentResponse,
} from "@examify-tms/interfaces";

/** A flattened { lesson, todo } pair from a lesson's checklist. */
export type LessonChecklistItem = {
  lesson: LessonResponse;
  todo: LessonTodo;
};

/** Human label for the immediately preceding period, used in sub-lines. */
export function previousPeriodLabel(period: DashboardPeriod): string {
  switch (period) {
    case "week":
      return "Last week";
    case "month":
      return "Last month";
    case "six_months":
      return "Prev 6 months";
    case "year":
      return "Last year";
  }
}

/**
 * Extract the first http(s) URL from a free-text lesson location string
 * (e.g. a pasted Google Meet / Zoom link). Returns null when there is none.
 */
export function extractCallLink(
  location: string | null | undefined,
): string | null {
  if (!location) return null;
  const match = location.match(/https?:\/\/[^\s,]+/i);
  return match ? match[0] : null;
}

/** True when a URL points to a Google Meet room. */
export function isGoogleMeet(url: string): boolean {
  return /meet\.google\.com/i.test(url);
}

/** Format a number as currency (defaults to AUD). Pass the tutor's currency. */
export function formatCurrency(amount: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
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

/**
 * The [start, end) window (ms since epoch) for the NEXT period after the
 * selected one — used for forward-looking "expected income". Anchored to UTC
 * calendar boundaries:
 * - week: next calendar week, Monday → Sunday
 * - month: next calendar month
 * - six_months: the next 6 calendar months
 * - year: next calendar year
 */
export function nextPeriodRange(
  period: DashboardPeriod,
  now: Date = new Date(),
): { start: number; end: number } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (period === "week") {
    const todayMs = Date.UTC(year, month, day);
    const dow = new Date(todayMs).getUTCDay(); // 0 = Sun .. 6 = Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const thisMonday = Date.UTC(year, month, day + diffToMonday);
    const start = thisMonday + 7 * 86_400_000;
    const end = start + 7 * 86_400_000;
    return { start, end };
  }
  if (period === "month") {
    return { start: Date.UTC(year, month + 1, 1), end: Date.UTC(year, month + 2, 1) };
  }
  if (period === "six_months") {
    return { start: Date.UTC(year, month + 1, 1), end: Date.UTC(year, month + 7, 1) };
  }
  return { start: Date.UTC(year + 1, 0, 1), end: Date.UTC(year + 2, 0, 1) };
}

/** Human label for the next period, e.g. "Next week", "Next month". */
export function nextPeriodLabel(period: DashboardPeriod): string {
  switch (period) {
    case "week":
      return "Next week";
    case "month":
      return "Next month";
    case "six_months":
      return "Next 6 months";
    case "year":
      return "Next year";
  }
}

/**
 * Planned (non-cancelled) lessons that fall within the NEXT period's window.
 */
export function plannedLessons(
  lessons: LessonResponse[],
  period: DashboardPeriod,
  now: Date = new Date(),
): LessonResponse[] {
  const { start, end } = nextPeriodRange(period, now);
  return lessons.filter((l) => {
    if (l.isCancelled) return false;
    const t = new Date(l.startDateTime).getTime();
    return t >= start && t < end;
  });
}

/**
 * Expected income for the next period, derived from its planned lessons and
 * each student's expectedAmount / rateType. Hourly rates bill per hour
 * (durationMinutes / 60), per_lesson rates bill a flat unit per lesson.
 */
export function expectedIncomeFromLessons(
  lessons: LessonResponse[],
  students: Record<string, StudentResponse>,
  period: DashboardPeriod,
  now: Date = new Date(),
): number {
  return sum(
    plannedLessons(lessons, period, now).map((l) => {
      const student = students[l.studentId];
      if (!student) return 0;
      const quantity =
        student.rateType === "hourly"
          ? Math.round((l.durationMinutes / 60) * 100) / 100
          : 1;
      return student.expectedAmount * quantity;
    }),
  );
}
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

/** The single next upcoming non-cancelled lesson, or undefined. */
export function nextLesson(
  lessons: LessonResponse[],
): LessonResponse | undefined {
  return upcomingLessons(lessons, 1)[0];
}

/**
 * Compact countdown to a future timestamp, e.g. "in 45 min", "in 3h 15m",
 * "in 2d 5h". Returns "Now" when within the minute, and "Started" if past.
 */
export function timeUntil(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Started";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins ? `in ${hours}h ${remMins}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `in ${days}d ${remHours}h` : `in ${days}d`;
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

/**
 * Flatten the per-lesson checklists (the "Todos" on each lesson detail page)
 * into a single dashboard list. Returns only incomplete todos from
 * non-cancelled lessons, sorted by lesson start time ascending so the soonest
 * (and overdue) prep surfaces first.
 */
export function lessonChecklistTodos(
  lessons: LessonResponse[],
  limit = 12,
): LessonChecklistItem[] {
  const items: LessonChecklistItem[] = [];
  for (const lesson of lessons) {
    if (lesson.isCancelled) continue;
    if (!lesson.todos || lesson.todos.length === 0) continue;
    for (const todo of lesson.todos) {
      if (todo.done) continue;
      items.push({ lesson, todo });
    }
  }
  items.sort(
    (a, b) =>
      new Date(a.lesson.startDateTime).getTime() -
      new Date(b.lesson.startDateTime).getTime(),
  );
  return items.slice(0, limit);
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

/* ------------------------------------------------------------------ *
 * Chart helpers — used by the hours + income charts to layer a        *
 * previous-period overlay, average line, today marker, and stats.     *
 * ------------------------------------------------------------------ */

export type ChartPoint = {
  label: string;
  current: number;
  previous: number;
};

/**
 * Merge the current and previous-period series into one dataset aligned by
 * ordinal bucket index (so week↔week, month-day↔month-day, etc.). The X axis
 * uses the current period's labels.
 */
export function buildChartData(
  current: DashboardSeriesPoint[],
  previous: DashboardSeriesPoint[],
): ChartPoint[] {
  return current.map((p, i) => ({
    label: p.label,
    current: p.value,
    previous: previous[i]?.value ?? 0,
  }));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

export function peak(values: number[]): number {
  return values.length ? Math.max(...values) : 0;
}

/** The axis label of the bucket containing today (for the "today" marker). */
export function todayBucketLabel(
  series: DashboardSeriesPoint[],
): string | null {
  const today = new Date();
  const found = series.find((p) => isSameDay(new Date(p.date), today));
  return found?.label ?? null;
}

/** True when there are too many buckets to legibly show per-point labels. */
export function isDenseSeries(series: DashboardSeriesPoint[]): boolean {
  return series.length > 14;
}
