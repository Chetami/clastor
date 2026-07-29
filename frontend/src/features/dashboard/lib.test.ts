import { describe, it, expect } from "vitest";
import type {
  DashboardSeriesPoint,
  LessonResponse,
  StudentResponse,
} from "@examify-tms/interfaces";
import {
  deltaPercent,
  formatHours,
  previousPeriodLabel,
  currentPeriodLabel,
  buildChartData,
  sum,
  mean,
  peak,
  isDenseSeries,
  timeUntil,
  plannedLessons,
  expectedIncomeFromLessons,
} from "./lib";

describe("deltaPercent", () => {
  it("returns null when there was no activity in either period", () => {
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it("reports +100% ('new activity') when previous is zero but current is positive", () => {
    expect(deltaPercent(10, 0)).toBe(100);
  });

  it("computes the percentage change otherwise", () => {
    expect(deltaPercent(10, 5)).toBe(100);
    expect(deltaPercent(5, 10)).toBe(-50);
    expect(deltaPercent(0, 10)).toBe(-100);
  });
});

describe("formatHours", () => {
  it("trims a trailing .0", () => {
    expect(formatHours(2)).toBe("2h");
    expect(formatHours(0)).toBe("0h");
  });

  it("keeps one decimal when meaningful", () => {
    expect(formatHours(1.5)).toBe("1.5h");
  });
});

describe("period labels", () => {
  it("maps each period to a human previous-period label", () => {
    expect(previousPeriodLabel("week")).toBe("Last week");
    expect(previousPeriodLabel("month")).toBe("Last month");
    expect(previousPeriodLabel("six_months")).toBe("Prev 6 months");
    expect(previousPeriodLabel("year")).toBe("Last year");
  });

  it("maps each period to a human current-period label", () => {
    expect(currentPeriodLabel("week")).toBe("This week");
    expect(currentPeriodLabel("month")).toBe("This month");
    expect(currentPeriodLabel("six_months")).toBe("This period");
    expect(currentPeriodLabel("year")).toBe("This year");
  });
});

describe("array math helpers", () => {
  it("sums", () => expect(sum([1, 2, 3, 4])).toBe(10));
  it("means, returning 0 for empty input", () => {
    expect(mean([])).toBe(0);
    expect(mean([2, 4, 6])).toBe(4);
  });
  it("peaks, returning 0 for empty input", () => {
    expect(peak([])).toBe(0);
    expect(peak([3, 9, 1])).toBe(9);
  });
});

describe("isDenseSeries", () => {
  it("is true once a series exceeds 14 buckets", () => {
    expect(isDenseSeries(Array.from({ length: 14 }))).toBe(false);
    expect(isDenseSeries(Array.from({ length: 15 }))).toBe(true);
  });
});

describe("buildChartData", () => {
  it("aligns current and previous series by bucket index", () => {
    const current = [
      { label: "Mon", value: 5, date: "2025-01-01" },
      { label: "Tue", value: 8, date: "2025-01-02" },
    ] as DashboardSeriesPoint[];
    const previous = [
      { label: "Mon", value: 3, date: "2024-12-30" },
    ] as DashboardSeriesPoint[];

    expect(buildChartData(current, previous)).toEqual([
      { label: "Mon", current: 5, previous: 3 },
      { label: "Tue", current: 8, previous: 0 },
    ]);
  });
});

describe("timeUntil", () => {
  const now = new Date("2025-06-04T10:00:00Z").getTime();

  it("says 'Started' for past or current times", () => {
    expect(timeUntil(new Date(now).toISOString(), now)).toBe("Started");
    expect(timeUntil(new Date(now - 1000).toISOString(), now)).toBe("Started");
  });

  it("says 'Now' inside the same minute", () => {
    expect(timeUntil(new Date(now + 30_000).toISOString(), now)).toBe("Now");
  });

  it("formats minutes, hours and days", () => {
    expect(timeUntil(new Date(now + 45 * 60_000).toISOString(), now)).toBe(
      "in 45 min",
    );
    expect(timeUntil(new Date(now + 3 * 3_600_000).toISOString(), now)).toBe(
      "in 3h",
    );
    expect(
      timeUntil(new Date(now + (3 * 3_600_000 + 15 * 60_000)).toISOString(), now),
    ).toBe("in 3h 15m");
    expect(timeUntil(new Date(now + 2 * 86_400_000).toISOString(), now)).toBe(
      "in 2d",
    );
  });
});

describe("plannedLessons + expectedIncomeFromLessons", () => {
  const now = new Date("2025-06-04T10:00:00Z"); // a Wednesday
  const inWeek = now.toISOString();

  const lessons = [
    // In-window, not cancelled — counts.
    { startDateTime: inWeek, isCancelled: false, durationMinutes: 60, studentId: "s1" },
    // Same slot but cancelled — dropped.
    { startDateTime: inWeek, isCancelled: true, durationMinutes: 60, studentId: "s1" },
    // Far outside the window — dropped.
    {
      startDateTime: "2024-01-01T00:00:00.000Z",
      isCancelled: false,
      durationMinutes: 60,
      studentId: "s1",
    },
  ] as unknown as LessonResponse[];

  it("keeps only non-cancelled lessons in the current week", () => {
    const planned = plannedLessons(lessons, "week", now);
    expect(planned).toHaveLength(1);
    expect(planned[0].startDateTime).toBe(inWeek);
  });

  it("bills hourly students by duration and per-lesson students flat", () => {
    const students: Record<string, StudentResponse> = {
      s1: { expectedAmount: 60, rateType: "hourly" } as StudentResponse,
    };
    // 60 min at $60/hr ⇒ quantity 1 ⇒ $60.
    expect(
      expectedIncomeFromLessons(lessons, students, "week", now),
    ).toBe(60);
  });
});
