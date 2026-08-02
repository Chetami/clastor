import { describe, it, expect } from "vitest";
import type { LessonResponse } from "@examify-tms/interfaces";
import {
  deriveLessonStatus,
  lessonEndDate,
  isLessonFinished,
  isRangeOverlap,
  isUpcomingLesson,
  isToday,
  formatMsRemaining,
  formatLessonDate,
  formatLessonTime,
  ATTENDANCE_LABELS,
  ACCEPTANCE_LABELS,
  ATTENDANCE_OPTIONS,
  STUDENT_NOTIFY_COOLDOWN_MS,
  INVOICE_RESEND_COOLDOWN_MS,
} from "@examify-tms/shared";

const PAST = "2020-01-01T12:00:00.000Z";
const FUTURE = "2099-01-01T12:00:00.000Z";

/** Minimal lesson cast — tests only set the fields each helper reads. */
function lesson(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    id: "lesson_1",
    startDateTime: PAST,
    durationMinutes: 60,
    attendanceStatus: "unrecorded",
    isCancelled: false,
    ...overrides,
  } as unknown as LessonResponse;
}

describe("deriveLessonStatus", () => {
  it("is cancelled when the forward flag or a tutor-cancelled outcome is set", () => {
    expect(deriveLessonStatus("present", true)).toBe("cancelled");
    expect(deriveLessonStatus("tutor_cancelled")).toBe("cancelled");
    expect(deriveLessonStatus("tutor_cancelled_makeup_issued")).toBe("cancelled");
  });

  it("is scheduled before attendance is recorded", () => {
    expect(deriveLessonStatus("unrecorded")).toBe("scheduled");
  });

  it("is completed once attendance is recorded", () => {
    expect(deriveLessonStatus("present")).toBe("completed");
    expect(deriveLessonStatus("present_late")).toBe("completed");
    expect(deriveLessonStatus("absent_no_makeup")).toBe("completed");
  });
});

describe("lessonEndDate", () => {
  it("adds the duration to the start time", () => {
    expect(lessonEndDate(lesson({ startDateTime: PAST, durationMinutes: 60 })).toISOString()).toBe(
      "2020-01-01T13:00:00.000Z",
    );
    expect(
      lessonEndDate(lesson({ startDateTime: PAST, durationMinutes: 90 })).toISOString(),
    ).toBe("2020-01-01T13:30:00.000Z");
  });
});

describe("isLessonFinished", () => {
  it("is finished once attendance is recorded, regardless of timing", () => {
    expect(isLessonFinished(lesson({ attendanceStatus: "present" }))).toBe(true);
  });

  it("is not finished when unrecorded and the end time is still ahead", () => {
    expect(
      isLessonFinished(
        lesson({ attendanceStatus: "unrecorded", startDateTime: FUTURE }),
      ),
    ).toBe(false);
  });

  it("is finished when unrecorded but the end time has passed", () => {
    expect(
      isLessonFinished(
        lesson({ attendanceStatus: "unrecorded", startDateTime: PAST }),
      ),
    ).toBe(true);
  });
});

describe("isUpcomingLesson", () => {
  it("is upcoming when the start time has not arrived", () => {
    expect(isUpcomingLesson(lesson({ startDateTime: FUTURE }))).toBe(true);
    expect(isUpcomingLesson(lesson({ startDateTime: PAST }))).toBe(false);
  });
});

describe("isRangeOverlap", () => {
  const A_START = "2020-01-01T09:00:00.000Z";
  const A_END = "2020-01-01T10:00:00.000Z";

  it("overlaps when ranges intersect", () => {
    expect(isRangeOverlap(A_START, A_END, "2020-01-01T09:30:00.000Z", "2020-01-01T11:00:00.000Z")).toBe(true);
  });

  it("does not overlap when edges merely touch (half-open)", () => {
    expect(isRangeOverlap(A_START, A_END, A_END, "2020-01-01T11:00:00.000Z")).toBe(false);
  });

  it("does not overlap when fully disjoint", () => {
    expect(isRangeOverlap(A_START, A_END, "2020-01-02T09:00:00.000Z", "2020-01-02T10:00:00.000Z")).toBe(false);
  });
});

describe("isToday", () => {
  it("matches the current local calendar day only", () => {
    expect(isToday(new Date())).toBe(true);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });
});

describe("formatMsRemaining", () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it("returns an empty string for zero or negative durations", () => {
    expect(formatMsRemaining(0)).toBe("");
    expect(formatMsRemaining(-1)).toBe("");
  });

  it("renders sub-hour durations as minutes", () => {
    expect(formatMsRemaining(5 * MIN)).toBe("5m");
  });

  it("renders whole hours without minutes", () => {
    expect(formatMsRemaining(HOUR)).toBe("1h");
    expect(formatMsRemaining(3 * HOUR)).toBe("3h");
  });

  it("combines hours and minutes", () => {
    expect(formatMsRemaining(3 * HOUR + 15 * MIN)).toBe("3h 15m");
  });

  it("folds days into hours so a 24h cooldown reads '24h'", () => {
    expect(formatMsRemaining(24 * HOUR)).toBe("24h");
    expect(formatMsRemaining(25 * HOUR)).toBe("25h");
  });
});

describe("lesson date/time formatters (en-AU)", () => {
  // Noon UTC on the 15th stays the 15th in every timezone.
  const noon = "2020-01-15T12:00:00.000Z";

  it("formatLessonDate shows weekday + day + month", () => {
    const out = formatLessonDate(noon);
    expect(out).toContain("Jan");
    // Day-first in en-AU: the day number ("15") precedes the month ("Jan").
    expect(out.indexOf("15")).toBeLessThan(out.indexOf("Jan"));
    expect(out).toMatch(/Wed/i);
  });

  it("formatLessonTime renders a 12-hour clock time", () => {
    expect(formatLessonTime(noon)).toMatch(/\b\d{1,2}:\d{2}\s?(am|pm)/i);
  });
});

describe("label maps + options", () => {
  it("covers every attendance status", () => {
    expect(Object.keys(ATTENDANCE_LABELS).sort()).toEqual(
      [
        "absent_makeup_issued",
        "absent_no_makeup",
        "absent_warning",
        "present",
        "present_late",
        "tutor_cancelled",
        "tutor_cancelled_makeup_issued",
        "unrecorded",
      ].sort(),
    );
  });

  it("covers every acceptance status", () => {
    expect(Object.keys(ACCEPTANCE_LABELS).sort()).toEqual(
      ["accepted", "declined", "pending"].sort(),
    );
  });

  it("ATTENDANCE_OPTIONS is non-empty and all values are known statuses", () => {
    expect(ATTENDANCE_OPTIONS.length).toBeGreaterThan(0);
    for (const status of ATTENDANCE_OPTIONS) {
      expect(ATTENDANCE_LABELS).toHaveProperty(status);
    }
  });
});

describe("backend-mirrored cooldowns", () => {
  it("both default to 24h (mirroring NOTIFY_COOLDOWN_MS / INVOICE_RESEND_COOLDOWN_MS)", () => {
    const dayMs = 24 * 60 * 60 * 1000;
    expect(STUDENT_NOTIFY_COOLDOWN_MS).toBe(dayMs);
    expect(INVOICE_RESEND_COOLDOWN_MS).toBe(dayMs);
  });
});
