import type {
  DashboardPeriod,
  LessonResponse,
} from "@examify-tms/interfaces";

/**
 * Mobile-only formatting helpers. Mirrors the web frontend's
 * `features/dashboard/lib.ts` and `features/students/student-utils.ts` but
 * depends only on the JS Intl API (no `date-fns`, which isn't a mobile dep).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a number as currency (defaults to AUD). */
export function formatCurrency(amount: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format currency with cents. */
export function formatCurrencyFull(amount: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Compact currency without trailing cents when whole (e.g. "$45" not "$45.00"). */
export function compactCurrency(amount: number, currency = "AUD"): string {
  return amount % 1 === 0
    ? formatCurrencyFull(amount, currency).replace(/\.00$/, "")
    : formatCurrencyFull(amount, currency);
}

/** Format hours with one decimal place, trimmed of trailing .0. */
export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(1))}h`;
}

/**
 * Percentage change from previous to current. Returns null when both are zero.
 * When previous is zero but current is positive, reports +100%.
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

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

export function currentPeriodLabel(period: DashboardPeriod): string {
  switch (period) {
    case "week":
      return "This week";
    case "month":
      return "This month";
    case "six_months":
      return "This period";
    case "year":
      return "This year";
  }
}

/** "09:00" style 24h time for a Date. */
function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "09:00 – 10:00" style range for a lesson. */
export function lessonTimeRange(lesson: LessonResponse): string {
  const start = new Date(lesson.startDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Just the start time "09:00". */
export function lessonStartTime(lesson: LessonResponse): string {
  return formatTime(new Date(lesson.startDateTime));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Compact relative day label, e.g. "Today", "Tomorrow", "Mon 24 Mar". */
export function relativeDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Section header label for a date: "Mon 24 Mar" (used by the schedule list). */
export function daySectionLabel(iso: string): string {
  return relativeDayLabel(iso);
}

/** Long weekday for a date: "Monday". */
export function weekdayLong(iso: string): string {
  return WEEKDAYS_LONG[new Date(iso).getDay()];
}

/** "March 2026" style month title for a schedule header. */
export function monthYear(date: Date): string {
  const long = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][date.getMonth()];
  return `${long} ${date.getFullYear()}`;
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

/** Future non-cancelled lessons, sorted ascending, capped. */
export function upcomingLessons(
  lessons: LessonResponse[],
  limit = 50,
): LessonResponse[] {
  const now = Date.now();
  return lessons
    .filter(
      (l) => !l.isCancelled && new Date(l.startDateTime).getTime() >= now,
    )
    .sort(
      (a, b) =>
        new Date(a.startDateTime).getTime() -
        new Date(b.startDateTime).getTime(),
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
 * Past, non-cancelled lessons whose attendance is still unrecorded — the
 * "things to do". Sorted most-recent first.
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
        new Date(b.startDateTime).getTime() -
        new Date(a.startDateTime).getTime(),
    )
    .slice(0, limit);
}

/** The lesson currently in progress (between start and end), if any. */
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

/** Group lessons by their calendar day (YYYY-MM-DD key), preserving order. */
export function groupByDay(
  lessons: LessonResponse[],
): { key: string; label: string; lessons: LessonResponse[] }[] {
  const groups: {
    key: string;
    label: string;
    lessons: LessonResponse[];
  }[] = [];
  const indexByKey = new Map<string, number>();
  for (const lesson of lessons) {
    const d = new Date(lesson.startDateTime);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
      d.getDate(),
    )}`;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ key, label: daySectionLabel(lesson.startDateTime), lessons: [] });
    }
    groups[idx].lessons.push(lesson);
  }
  return groups;
}

/** Two-letter initials from a name, e.g. "Alice Johnson" -> "AJ". */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Rate unit suffix: "/hr" or "/lesson". */
export function rateUnit(rateType: "hourly" | "per_lesson"): string {
  return rateType === "hourly" ? "/hr" : "/lesson";
}

/** Frequency description: "4 hrs/wk" or "2/wk". */
export function formatFrequency(
  frequency: number,
  rateType: "hourly" | "per_lesson",
): string {
  return rateType === "hourly" ? `${frequency} hrs/wk` : `${frequency}/wk`;
}

/** Format an attendance rate (0–1) as a whole percent, or "—" when null. */
export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Attendance display label for a status. */
export const ATTENDANCE_LABELS: Record<string, string> = {
  unrecorded: "Unrecorded",
  present: "Present",
  present_late: "Present (late)",
  absent_no_makeup: "Absent — no make-up",
  absent_makeup_issued: "Absent — make-up credit",
  absent_warning: "Absent — warning",
  tutor_cancelled: "Tutor cancelled",
  tutor_cancelled_makeup_issued: "Tutor cancelled — make-up",
};

/** Acceptance display label for a status. */
export const ACCEPTANCE_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};
