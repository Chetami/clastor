import { describe, it, expect } from "vitest";
import type {
  DayOfWeek,
  LessonResponse,
  LessonSlot,
} from "@examify-tms/interfaces";
import {
  ACCEPTANCE_TONE,
  DAY_SHORT,
  formatRange,
  formatSlot,
  groupLessonsByMonth,
  lessonIssues,
} from "./lesson-series-utils";

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
    invoiceId: null,
    isPaid: false,
    ...overrides,
  } as unknown as LessonResponse;
}

function slot(dayOfWeek: DayOfWeek, timeOfDay: string): LessonSlot {
  return { dayOfWeek, timeOfDay } as LessonSlot;
}

describe("lessonIssues", () => {
  it("surfaces no issues for a future lesson, even when unpaid/unrecorded", () => {
    expect(
      lessonIssues(
        lesson({
          startDateTime: FUTURE,
          attendanceStatus: "unrecorded",
          invoiceId: null,
          isPaid: false,
        }),
      ),
    ).toEqual([]);
  });

  it("surfaces no issues for a cancelled lesson", () => {
    expect(
      lessonIssues(
        lesson({ isCancelled: true, attendanceStatus: "unrecorded" }),
      ),
    ).toEqual([]);
  });

  it("flags an attendance issue for a past lesson with unrecorded attendance", () => {
    expect(
      lessonIssues(
        lesson({ attendanceStatus: "unrecorded", invoiceId: "inv_1" }),
      ),
    ).toEqual([{ kind: "attendance", label: "Attendance not recorded" }]);
  });

  it("flags an unpaid issue for a past lesson with no invoice and not paid", () => {
    expect(
      lessonIssues(
        lesson({
          attendanceStatus: "present",
          invoiceId: null,
          isPaid: false,
        }),
      ),
    ).toEqual([{ kind: "unpaid", label: "Unpaid" }]);
  });

  it("does NOT flag unpaid when an invoice already exists but is unpaid", () => {
    // Regression: the "Create invoice" nudge must disappear once an invoice
    // has been opened, regardless of payment status.
    expect(
      lessonIssues(
        lesson({
          attendanceStatus: "present",
          invoiceId: "inv_1",
          isPaid: false,
        }),
      ),
    ).toEqual([]);
  });

  it("does NOT flag unpaid when the lesson is paid", () => {
    expect(
      lessonIssues(
        lesson({ attendanceStatus: "present", isPaid: true }),
      ),
    ).toEqual([]);
  });

  it("does NOT flag unpaid for a credited absence with no invoice", () => {
    // A lesson where a make-up credit was issued is never billed, so it must
    // not surface a "Create invoice" nudge even though no invoice exists.
    expect(
      lessonIssues(
        lesson({
          attendanceStatus: "absent_makeup_issued",
          invoiceId: null,
          isPaid: false,
        }),
      ),
    ).toEqual([]);
  });

  it("does NOT flag unpaid for a tutor-cancelled credited lesson", () => {
    expect(
      lessonIssues(
        lesson({
          attendanceStatus: "tutor_cancelled_makeup_issued",
          invoiceId: null,
          isPaid: false,
        }),
      ),
    ).toEqual([]);
  });

  it("still flags unpaid for a non-credited absence", () => {
    expect(
      lessonIssues(
        lesson({
          attendanceStatus: "absent_no_makeup",
          invoiceId: null,
          isPaid: false,
        }),
      ),
    ).toEqual([{ kind: "unpaid", label: "Unpaid" }]);
  });

  it("surfaces both issues when attendance is unrecorded and it is uninvoiced", () => {
    expect(
      lessonIssues(
        lesson({ attendanceStatus: "unrecorded", invoiceId: null }),
      ),
    ).toEqual([
      { kind: "attendance", label: "Attendance not recorded" },
      { kind: "unpaid", label: "Unpaid" },
    ]);
  });

  it("surfaces no issues for a fully resolved past lesson (recorded + paid)", () => {
    expect(
      lessonIssues(
        lesson({ attendanceStatus: "present", isPaid: true }),
      ),
    ).toEqual([]);
  });
});

describe("formatSlot", () => {
  it("formats a morning slot as 12-hour AM", () => {
    expect(formatSlot(slot("monday", "07:30"))).toBe("Mon 7:30 AM");
  });

  it("formats an evening slot as 12-hour PM", () => {
    expect(formatSlot(slot("monday", "19:30"))).toBe("Mon 7:30 PM");
  });

  it("renders midnight as 12:00 AM", () => {
    expect(formatSlot(slot("wednesday", "00:00"))).toBe("Wed 12:00 AM");
  });

  it("renders noon as 12:00 PM", () => {
    expect(formatSlot(slot("friday", "12:00"))).toBe("Fri 12:00 PM");
  });

  it("uses the short weekday label for each day", () => {
    expect(formatSlot(slot("tuesday", "16:00"))).toBe("Tue 4:00 PM");
    expect(formatSlot(slot("sunday", "09:05"))).toBe("Sun 9:05 AM");
  });
});

describe("formatRange", () => {
  it("formats a bounded range as 'start – end'", () => {
    expect(formatRange("2026-01-05", "2026-03-30")).toBe(
      "Jan 5, 2026 – Mar 30, 2026",
    );
  });

  it("formats an open-ended range with a 'from' prefix", () => {
    expect(formatRange("2026-01-05", null)).toBe("from Jan 5, 2026");
  });
});

describe("groupLessonsByMonth", () => {
  // Noon UTC keeps the calendar month stable across every timezone.
  const janA = lesson({ id: "a", startDateTime: "2026-01-10T12:00:00.000Z" });
  const janB = lesson({ id: "b", startDateTime: "2026-01-20T12:00:00.000Z" });
  const mar = lesson({ id: "c", startDateTime: "2026-03-05T12:00:00.000Z" });
  const dec = lesson({ id: "d", startDateTime: "2025-12-31T12:00:00.000Z" });

  it("returns no groups for an empty list", () => {
    expect(groupLessonsByMonth([])).toEqual([]);
  });

  it("groups lessons into chronological month buckets", () => {
    const groups = groupLessonsByMonth([mar, janA, dec, janB]);
    expect(groups.map((g) => g.key)).toEqual([
      "2025-12",
      "2026-01",
      "2026-03",
    ]);
  });

  it("sorts lessons within each group chronologically and keeps co-month lessons together", () => {
    const groups = groupLessonsByMonth([janB, janA]);
    expect(groups).toHaveLength(1);
    expect(groups[0].lessons.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("labels each group with the long month name and year", () => {
    const groups = groupLessonsByMonth([mar]);
    expect(groups[0].label).toBe("March 2026");
  });
});

describe("label / tone maps", () => {
  it("DAY_SHORT covers every day of the week", () => {
    expect(Object.keys(DAY_SHORT).sort()).toEqual(
      [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].sort(),
    );
  });

  it("ACCEPTANCE_TONE covers every acceptance status", () => {
    expect(Object.keys(ACCEPTANCE_TONE).sort()).toEqual(
      ["accepted", "declined", "pending"].sort(),
    );
  });
});
