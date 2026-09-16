import { describe, it, expect } from "vitest";
import type { LessonResponse } from "@examify-tms/interfaces";
import {
  computeStudentStats,
  emptyStudentStats,
  studentStatsWindow,
} from "@examify-tms/shared";

// Fixed clock: September 15, 2026. The month window is Sep 1 → Oct 1 UTC.
const NOW = new Date("2026-09-15T12:00:00.000Z");

let seq = 0;

function makeLesson(
  overrides: Partial<LessonResponse> = {},
): LessonResponse {
  return {
    id: `lesson_${++seq}`,
    studentId: "student_1",
    startDateTime: "2026-09-10T15:00:00.000Z",
    durationMinutes: 60,
    acceptanceStatus: "accepted",
    attendanceStatus: "unrecorded",
    isCancelled: false,
    remindersEnabled: true,
    isPaid: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as LessonResponse;
}

describe("studentStatsWindow", () => {
  it("anchors the month window to calendar boundaries", () => {
    expect(studentStatsWindow("month", NOW)).toEqual({
      start: Date.UTC(2026, 8, 1),
      end: Date.UTC(2026, 9, 1),
    });
  });

  it("covers the last 6 calendar months including the current one", () => {
    expect(studentStatsWindow("six_months", NOW)).toEqual({
      start: Date.UTC(2026, 3, 1),
      end: Date.UTC(2026, 9, 1),
    });
  });

  it("covers the current calendar year", () => {
    expect(studentStatsWindow("year", NOW)).toEqual({
      start: Date.UTC(2026, 0, 1),
      end: Date.UTC(2027, 0, 1),
    });
  });
});

describe("computeStudentStats", () => {
  it("returns an empty map when there are no lessons", () => {
    expect(computeStudentStats([], "month", NOW)).toEqual({});
  });

  it("classifies each lesson into exactly one outcome bucket", () => {
    const lessons = [
      makeLesson({ attendanceStatus: "present" }),
      makeLesson({ attendanceStatus: "present_late" }),
      makeLesson({ attendanceStatus: "absent_no_makeup" }),
      makeLesson({ attendanceStatus: "absent_makeup_issued" }),
      makeLesson({ attendanceStatus: "absent_warning" }),
      makeLesson({ attendanceStatus: "tutor_cancelled" }),
      makeLesson({
        isCancelled: true,
        startDateTime: "2026-09-11T15:00:00.000Z",
      }),
      makeLesson({ acceptanceStatus: "declined" }),
      makeLesson({ startDateTime: "2026-09-20T15:00:00.000Z" }), // upcoming
    ];

    const stats = computeStudentStats(lessons, "month", NOW)["student_1"];
    expect(stats).toMatchObject({
      total: 9,
      attended: 2,
      late: 1,
      noShows: 3,
      tutorCancels: 2,
      declined: 1,
      upcoming: 1,
      disruptions: 6,
    });
  });

  it("counts a cancelled lesson once even when the student also declined it", () => {
    const lessons = [
      makeLesson({ isCancelled: true, acceptanceStatus: "declined" }),
      makeLesson({ attendanceStatus: "tutor_cancelled" }),
    ];
    const stats = computeStudentStats(lessons, "month", NOW)["student_1"];
    expect(stats.tutorCancels).toBe(2);
    expect(stats.declined).toBe(0);
  });

  it("ignores lessons outside the period window", () => {
    const lessons = [
      makeLesson({ startDateTime: "2026-08-31T23:59:59.000Z" }), // before month
      makeLesson({ startDateTime: "2026-10-01T00:00:00.000Z" }), // at month end
      makeLesson({ attendanceStatus: "present" }), // inside
    ];
    const stats = computeStudentStats(lessons, "month", NOW)["student_1"];
    expect(stats.total).toBe(1);
    expect(stats.attended).toBe(1);
  });

  it("includes lessons from the whole 6-month window", () => {
    const lessons = [
      makeLesson({ attendanceStatus: "present", startDateTime: "2026-04-01T00:00:00.000Z" }),
      makeLesson({ attendanceStatus: "present", startDateTime: "2026-09-30T23:00:00.000Z" }),
    ];
    const stats = computeStudentStats(lessons, "six_months", NOW)["student_1"];
    expect(stats.total).toBe(2);
  });

  it("rolls up each student separately", () => {
    const lessons = [
      makeLesson({ studentId: "student_1", attendanceStatus: "present" }),
      makeLesson({ studentId: "student_2", attendanceStatus: "absent_no_makeup" }),
    ];
    const byId = computeStudentStats(lessons, "month", NOW);
    expect(byId.student_1.attended).toBe(1);
    expect(byId.student_1.noShows).toBe(0);
    expect(byId.student_2.attended).toBe(0);
    expect(byId.student_2.noShows).toBe(1);
  });

  it("computes rates over resolved lessons and nulls them when nothing resolved", () => {
    const resolved = [
      makeLesson({ attendanceStatus: "present" }),
      makeLesson({ attendanceStatus: "present_late" }),
      makeLesson({ attendanceStatus: "absent_no_makeup" }),
    ];
    const stats = computeStudentStats(resolved, "month", NOW)["student_1"];
    expect(stats.attendedRate).toBeCloseTo(2 / 3);
    expect(stats.noShowRate).toBeCloseTo(1 / 3);
    expect(stats.disruptionRate).toBeCloseTo(1 / 3);

    const upcomingOnly = [
      makeLesson({ startDateTime: "2026-09-20T15:00:00.000Z" }),
    ];
    const empty = computeStudentStats(upcomingOnly, "month", NOW)[
      "student_1"
    ];
    expect(empty.attendedRate).toBeNull();
    expect(empty.noShowRate).toBeNull();
    expect(empty.disruptionRate).toBe(0);
  });

  it("warns when more than 20% of at least 3 resolved lessons were no-shows", () => {
    // 3 no-shows of 12 resolved = 25% → warned.
    const warned = Array.from({ length: 9 }, () =>
      makeLesson({ attendanceStatus: "present" }),
    ).concat(
      Array.from({ length: 3 }, () =>
        makeLesson({ attendanceStatus: "absent_no_makeup" }),
      ),
    );
    expect(computeStudentStats(warned, "month", NOW).student_1.warning).toBe(
      true,
    );

    // 2 no-shows of 12 resolved = ~17% → not warned.
    const mild = Array.from({ length: 10 }, () =>
      makeLesson({ attendanceStatus: "present" }),
    ).concat(
      Array.from({ length: 2 }, () =>
        makeLesson({ attendanceStatus: "absent_no_makeup" }),
      ),
    );
    expect(computeStudentStats(mild, "month", NOW).student_1.warning).toBe(
      false,
    );

    // 1 no-show of 2 resolved = 50%, but under 3 resolved → not warned.
    const tooFew = [
      makeLesson({ attendanceStatus: "present" }),
      makeLesson({ attendanceStatus: "absent_no_makeup" }),
    ];
    expect(computeStudentStats(tooFew, "month", NOW).student_1.warning).toBe(
      false,
    );
  });

  it("counts tutor cancels as disruptions without triggering the warning", () => {
    // Tutor-side disruption is not the student's fault — never warned.
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({
        startDateTime: `2026-09-0${(i % 9) + 1}T15:00:00.000Z`,
        isCancelled: true,
      }),
    );
    const stats = computeStudentStats(lessons, "month", NOW)["student_1"];
    expect(stats.tutorCancels).toBe(10);
    expect(stats.disruptions).toBe(10);
    expect(stats.warning).toBe(false);
  });
});

describe("emptyStudentStats", () => {
  it("is fully zeroed with null rates and no warning", () => {
    expect(emptyStudentStats("student_1")).toEqual({
      studentId: "student_1",
      total: 0,
      attended: 0,
      late: 0,
      noShows: 0,
      tutorCancels: 0,
      declined: 0,
      upcoming: 0,
      disruptions: 0,
      attendedRate: null,
      noShowRate: null,
      disruptionRate: null,
      warning: false,
    });
  });
});