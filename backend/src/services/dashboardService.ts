import {
  DashboardPeriod,
  DashboardSummaryResponse,
  DashboardSeriesPoint,
  AttendanceStatus,
} from "@examify-tms/interfaces";
import { listLessonsFromFirestore } from "./lessonService";
import { listInvoicesFromFirestore } from "./paymentService";
import { listStudentsFromFirestore } from "./studentService";

/**
 * Attendance outcomes that count as a lesson actually having been taught.
 * Used when computing "hours worked".
 */
const PRESENT_STATUSES: AttendanceStatus[] = ["present", "present_late"];

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
function getRange(period: DashboardPeriod, now: Date): Range {
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
function getPreviousRange(period: DashboardPeriod, current: Range): Range {
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

    // ---- Hours worked ----
    // Sum durationMinutes of non-cancelled, attended (present/present_late)
    // lessons whose start falls in the window. Convert minutes → hours.
    let currentMinutes = 0;
    let previousMinutes = 0;
    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
      const start = new Date(lesson.startDateTime as any).getTime();
      let minutes = 0;
      if (start >= rangeStartMs && start < rangeEndMs) {
        minutes = lesson.durationMinutes;
        currentMinutes += minutes;
      } else if (start >= prevStartMs && start < rangeStartMs) {
        previousMinutes += lesson.durationMinutes;
      }
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
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

    // ---- Chart series (current period only) ----
    const hoursSeries = getBuckets(period, range);
    const incomeSeries = getBuckets(period, range);
    const hoursBucketDates = hoursSeries.map((b) => new Date(b.date).getTime());
    const incomeBucketDates = incomeSeries.map((b) =>
      new Date(b.date).getTime()
    );

    for (const lesson of lessons) {
      if (lesson.isCancelled) continue;
      if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
      const start = new Date(lesson.startDateTime as any).getTime();
      if (start < rangeStartMs || start >= rangeEndMs) continue;
      const idx = bucketIndex(start, hoursBucketDates);
      if (idx >= 0) {
        hoursSeries[idx].value = round2(
          hoursSeries[idx].value + lesson.durationMinutes / 60
        );
      }
    }

    for (const invoice of invoices) {
      if (invoice.status !== "paid" || !invoice.paidAt) continue;
      const paid = new Date(invoice.paidAt as any).getTime();
      if (paid < rangeStartMs || paid >= rangeEndMs) continue;
      const idx = bucketIndex(paid, incomeBucketDates);
      if (idx >= 0) {
        incomeSeries[idx].value = round2(
          incomeSeries[idx].value + invoice.total
        );
      }
    }

    // ---- Student count (active, point-in-time) ----
    const studentCount = students.filter((s) => s.status === "active").length;

    return {
      period,
      rangeStart: range.start.toISOString(),
      rangeEnd: range.end.toISOString(),
      hoursWorked,
      income,
      studentCount,
      hoursSeries,
      incomeSeries,
      previousHoursWorked,
      previousIncome: previousIncomeRounded,
    };
  } catch (error) {
    console.error("Failed to compute dashboard summary:", error);
    throw new Error("Failed to compute dashboard summary");
  }
}
