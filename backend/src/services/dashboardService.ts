import {
  DashboardPeriod,
  DashboardSummaryResponse,
  DashboardSeriesPoint,
  AttendanceStatus,
  Lesson,
  Invoice,
} from "@examify-tms/interfaces";
import { listLessonsFromFirestore } from "./lessonService";
import { listInvoicesFromFirestore } from "./paymentService";
import { listStudentsFromFirestore } from "./studentService";

/**
 * Attendance outcomes that count as a lesson actually having been taught.
 * Used when computing "hours worked".
 */
export const PRESENT_STATUSES: AttendanceStatus[] = ["present", "present_late"];

/**
 * Attendance outcomes that count as a student-initiated absence — the
 * denominator of the attendance rate. Tutor cancellations are excluded
 * (not the student's fault), as are unrecorded lessons (unknown outcome).
 */
const ABSENT_STATUSES: AttendanceStatus[] = [
  "absent_no_makeup",
  "absent_makeup_issued",
  "absent_warning",
];

/** True when two dates fall on the same UTC calendar day. */
function isSameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

interface Range {
  start: Date;
  end: Date;
}

/**
 * Compute the [start, end) window for the requested period, in UTC.
 * - week: current calendar week, Monday → Sunday
 * - month: current calendar month
 * - six_months: the last 6 calendar months including the current one
 * - year: current calendar year
 */
export function getRange(period: DashboardPeriod, now: Date): Range {
  if (period === "week") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const day = start.getUTCDay(); // 0 = Sun .. 6 = Sat
    const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
    start.setUTCDate(start.getUTCDate() + diff);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }
  if (period === "month") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }
  if (period === "six_months") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }
  // year
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
    end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)),
  };
}

/**
 * Compute the immediately preceding period of the same length, used for the
 * delta (%) shown on the stat cards.
 */
export function getPreviousRange(period: DashboardPeriod, current: Range): Range {
  const end = current.start;
  if (period === "week") {
    const start = new Date(current.start);
    start.setUTCDate(start.getUTCDate() - 7);
    return { start, end };
  }
  if (period === "month") {
    return {
      start: new Date(
        Date.UTC(current.start.getUTCFullYear(), current.start.getUTCMonth() - 1, 1)
      ),
      end,
    };
  }
  if (period === "six_months") {
    return {
      start: new Date(
        Date.UTC(
          current.start.getUTCFullYear(),
          current.start.getUTCMonth() - 6,
          1
        )
      ),
      end,
    };
  }
  // year
  return {
    start: new Date(Date.UTC(current.start.getUTCFullYear() - 1, 0, 1)),
    end,
  };
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Build the chart buckets for a period. Buckets are contiguous and sorted:
 * - week/month → daily, six_months/year → monthly.
 */
function getBuckets(period: DashboardPeriod, range: Range): DashboardSeriesPoint[] {
  const buckets: DashboardSeriesPoint[] = [];

  if (period === "week") {
    for (let i = 0; i < 7; i++) {
      const d = new Date(range.start);
      d.setUTCDate(d.getUTCDate() + i);
      buckets.push({ label: DAY_LABELS[i], date: d.toISOString(), value: 0 });
    }
    return buckets;
  }

  if (period === "month") {
    const d = new Date(range.start);
    while (d.getTime() < range.end.getTime()) {
      buckets.push({
        label: String(d.getUTCDate()),
        date: new Date(d).toISOString(),
        value: 0,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return buckets;
  }

  // six_months / year → monthly
  const d = new Date(
    Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1)
  );
  while (d.getTime() < range.end.getTime()) {
    buckets.push({
      label: MONTH_LABELS[d.getUTCMonth()],
      date: new Date(d).toISOString(),
      value: 0,
    });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return buckets;
}

/**
 * Given a sorted (ascending) list of bucket start timestamps, return the index
 * of the bucket containing `ts`, or -1 if before/after the range.
 */
function bucketIndex(ts: number, bucketDates: number[]): number {
  for (let i = bucketDates.length - 1; i >= 0; i--) {
    if (ts >= bucketDates[i]) return i;
  }
  return -1;
}

/** Round to 2 decimal places (currency / hours). */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Build a per-bucket hours series for a range from raw lessons. */
function buildHoursSeries(
  period: DashboardPeriod,
  range: Range,
  lessons: Lesson[]
): DashboardSeriesPoint[] {
  const buckets = getBuckets(period, range);
  const bucketDates = buckets.map((b) => new Date(b.date).getTime());
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  for (const lesson of lessons) {
    if (lesson.isCancelled) continue;
    if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
    const start = new Date(lesson.startDateTime as any).getTime();
    if (start < startMs || start >= endMs) continue;
    const idx = bucketIndex(start, bucketDates);
    if (idx >= 0) {
      buckets[idx].value = round2(
        buckets[idx].value + lesson.durationMinutes / 60
      );
    }
  }
  return buckets;
}

/** Build a per-bucket income series for a range from raw invoices. */
function buildIncomeSeries(
  period: DashboardPeriod,
  range: Range,
  invoices: Invoice[]
): DashboardSeriesPoint[] {
  const buckets = getBuckets(period, range);
  const bucketDates = buckets.map((b) => new Date(b.date).getTime());
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  for (const invoice of invoices) {
    if (invoice.status !== "paid" || !invoice.paidAt) continue;
    const paid = new Date(invoice.paidAt as any).getTime();
    if (paid < startMs || paid >= endMs) continue;
    const idx = bucketIndex(paid, bucketDates);
    if (idx >= 0) {
      buckets[idx].value = round2(buckets[idx].value + invoice.total);
    }
  }
  return buckets;
}

/**
 * Compute the dashboard summary for the requesting tutor: hours worked,
 * income collected, active student count, per-bucket chart series for the
 * selected period, and the same totals for the preceding period (for delta %).
 *
 * Aggregation is done in memory from the existing list services (which already
 * scope by tutorId / role), matching the established pattern used across the
 * rest of the codebase to avoid Firestore composite-index requirements.
 */
export async function getDashboardSummary(
  userId: string,
  role: string,
  period: DashboardPeriod
): Promise<DashboardSummaryResponse> {
  try {
    const now = new Date();
    const range = getRange(period, now);
    const previous = getPreviousRange(period, range);

    const [lessons, invoices, students] = await Promise.all([
      listLessonsFromFirestore(userId, role),
      listInvoicesFromFirestore(userId, role),
      listStudentsFromFirestore(userId, role),
    ]);

    const rangeStartMs = range.start.getTime();
    const rangeEndMs = range.end.getTime();
    const prevStartMs = previous.start.getTime();

    // ---- Hours worked + lessons taught ----
    // Sum durationMinutes and count of non-cancelled, attended
    // (present/present_late) lessons whose start falls in the window.
    let currentMinutes = 0;
    let previousMinutes = 0;
    let currentLessonsTaught = 0;
    let previousLessonsTaught = 0;
    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
      const start = new Date(lesson.startDateTime as any).getTime();
      if (start >= rangeStartMs && start < rangeEndMs) {
        currentMinutes += lesson.durationMinutes;
        currentLessonsTaught++;
      } else if (start >= prevStartMs && start < rangeStartMs) {
        previousMinutes += lesson.durationMinutes;
        previousLessonsTaught++;
      }
    }
    const hoursWorked = round2(currentMinutes / 60);
    const previousHoursWorked = round2(previousMinutes / 60);

    // ---- Income ----
    // Sum totals of paid invoices whose paidAt falls in the window.
    let currentIncome = 0;
    let previousIncome = 0;
    for (const invoice of invoices) {
      if (invoice.status !== "paid") continue;
      if (!invoice.paidAt) continue;
      const paid = new Date(invoice.paidAt as any).getTime();
      if (paid >= rangeStartMs && paid < rangeEndMs) {
        currentIncome += invoice.total;
      } else if (paid >= prevStartMs && paid < rangeStartMs) {
        previousIncome += invoice.total;
      }
    }
    const income = round2(currentIncome);
    const previousIncomeRounded = round2(previousIncome);

    // ---- Chart series (current + previous period) ----
    const hoursSeries = buildHoursSeries(period, range, lessons);
    const incomeSeries = buildIncomeSeries(period, range, invoices);
    const previousHoursSeries = buildHoursSeries(period, previous, lessons);
    const previousIncomeSeries = buildIncomeSeries(period, previous, invoices);

    // ---- Student count (active, point-in-time) ----
    const studentCount = students.filter((s) => s.status === "active").length;

    // ---- Attendance rate (period) ----
    // present / (present + absent), excluding unrecorded + tutor_cancelled.
    let attendedInPeriod = 0;
    let absencesInPeriod = 0;
    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      const start = new Date(lesson.startDateTime as any).getTime();
      if (start < rangeStartMs || start >= rangeEndMs) continue;
      if (PRESENT_STATUSES.includes(lesson.attendanceStatus)) attendedInPeriod++;
      else if (ABSENT_STATUSES.includes(lesson.attendanceStatus)) absencesInPeriod++;
    }
    const recordedOutcomes = attendedInPeriod + absencesInPeriod;
    const attendanceRate =
      recordedOutcomes > 0 ? round2(attendedInPeriod / recordedOutcomes) : null;

    // ---- Unbilled lessons (period) ----
    // Attended lessons not yet attached to any invoice.
    let unbilledLessons = 0;
    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
      if (lesson.invoiceId) continue;
      const start = new Date(lesson.startDateTime as any).getTime();
      if (start < rangeStartMs || start >= rangeEndMs) continue;
      unbilledLessons++;
    }

    // ---- Outstanding / overdue (global point-in-time) ----
    // Outstanding = open + overdue; overdue is a subset. Both ignore period.
    let outstandingAmount = 0;
    let overdueAmount = 0;
    for (const invoice of invoices) {
      if (invoice.status === "open" || invoice.status === "overdue") {
        outstandingAmount += invoice.total;
      }
      if (invoice.status === "overdue") overdueAmount += invoice.total;
    }

    // ---- Today / yesterday breakdowns (UTC day, ignore period) ----
    const todayDate = new Date();
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);

    const today = { income: 0, hours: 0, lessonCount: 0 };
    const yesterday = { income: 0, hours: 0, lessonCount: 0 };

    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
      const start = new Date(lesson.startDateTime as any);
      if (isSameUTCDay(start, todayDate)) {
        today.hours += lesson.durationMinutes / 60;
        today.lessonCount++;
      } else if (isSameUTCDay(start, yesterdayDate)) {
        yesterday.hours += lesson.durationMinutes / 60;
        yesterday.lessonCount++;
      }
    }
    for (const invoice of invoices) {
      if (invoice.status !== "paid" || !invoice.paidAt) continue;
      const paid = new Date(invoice.paidAt as any);
      if (isSameUTCDay(paid, todayDate)) today.income += invoice.total;
      else if (isSameUTCDay(paid, yesterdayDate)) yesterday.income += invoice.total;
    }

    return {
      period,
      rangeStart: range.start.toISOString(),
      rangeEnd: range.end.toISOString(),
      hoursWorked,
      income,
      studentCount,
      hoursSeries,
      incomeSeries,
      previousHoursSeries,
      previousIncomeSeries,
      previousHoursWorked,
      previousIncome: previousIncomeRounded,
      lessonsTaught: currentLessonsTaught,
      previousLessonsTaught,
      attendanceRate,
      unbilledLessons,
      outstandingAmount: round2(outstandingAmount),
      overdueAmount: round2(overdueAmount),
      today: {
        income: round2(today.income),
        hours: round2(today.hours),
        lessonCount: today.lessonCount,
      },
      yesterday: {
        income: round2(yesterday.income),
        hours: round2(yesterday.hours),
        lessonCount: yesterday.lessonCount,
      },
    };
  } catch (error) {
    console.error("Failed to compute dashboard summary:", error);
    throw new Error("Failed to compute dashboard summary");
  }
}
