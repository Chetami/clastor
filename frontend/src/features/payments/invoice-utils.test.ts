import { describe, it, expect } from "vitest";
import type { InvoiceResponse, LessonResponse } from "@examify-tms/interfaces";
import {
  buildLessonDescription,
  buildLessonLineItem,
  defaultUnitAmount,
  defaultQuantity,
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  isOverdue,
  lineItemsSubtotal,
  DEFAULT_INVOICE_DUE_DAYS,
  defaultInvoiceDueDate,
  defaultInvoiceDueDateInput,
} from "@examify-tms/shared";

/** Minimal lesson cast so we only specify the fields the builders read. */
function lesson(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    id: "lesson_1",
    studentId: "stu_1",
    subject: "Mathematics",
    startDateTime: "2026-06-20T12:00:00.000Z",
    durationMinutes: 60,
    ...overrides,
  } as unknown as LessonResponse;
}

/** Minimal invoice cast — isOverdue only reads status + dueDate. */
function invoice(
  status: InvoiceResponse["status"],
  dueDate: string,
): InvoiceResponse {
  return { status, dueDate } as unknown as InvoiceResponse;
}

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

describe("buildLessonDescription", () => {
  it("formats subject, duration and date", () => {
    const desc = buildLessonDescription(
      lesson({ subject: "Physics", durationMinutes: 90 }),
    );
    expect(desc).toMatch(/^Physics — 90 min on /);
    // June 20 noon UTC is June 20 in every timezone, so the month/year are safe.
    expect(desc).toContain("Jun");
    expect(desc).toContain("2026");
  });

  it("falls back to 'Lesson' when there is no subject", () => {
    expect(buildLessonDescription(lesson({ subject: null }))).toMatch(
      /^Lesson — 60 min on /,
    );
  });
});

describe("buildLessonLineItem", () => {
  it("builds an hourly line item with hours as the quantity", () => {
    const source = lesson({ id: "l1", durationMinutes: 90 });
    const item = buildLessonLineItem(source, "hourly", 60);
    expect(item).toEqual({
      lessonId: "l1",
      description: buildLessonDescription(source),
      durationMinutes: 90,
      rateType: "hourly",
      unitAmount: 60,
      quantity: 1.5,
    });
  });

  it("treats a per-lesson rate as a single unit", () => {
    const item = buildLessonLineItem(
      lesson({ durationMinutes: 90 }),
      "per_lesson",
      90,
    );
    expect(item.rateType).toBe("per_lesson");
    expect(item.quantity).toBe(1);
    expect(item.unitAmount).toBe(90);
  });
});

describe("defaultQuantity / defaultUnitAmount", () => {
  it("converts minutes to billable hours, rounded to 2dp", () => {
    expect(defaultQuantity("hourly", 60)).toBe(1);
    expect(defaultQuantity("hourly", 90)).toBe(1.5);
    expect(defaultQuantity("hourly", 45)).toBe(0.75);
  });

  it("always bills one unit for a per-lesson rate", () => {
    expect(defaultQuantity("per_lesson", 60)).toBe(1);
    expect(defaultQuantity("per_lesson", 120)).toBe(1);
  });

  it("passes the expected amount through as the unit amount", () => {
    expect(defaultUnitAmount(0)).toBe(0);
    expect(defaultUnitAmount(55.5)).toBe(55.5);
  });
});

describe("currency formatting", () => {
  it("always renders two fraction digits for whole amounts", () => {
    expect(formatCurrency(60)).toMatch(/\.00$/);
    expect(formatCurrency(0)).toMatch(/0\.00$/);
  });

  it("compact strips the trailing .00 for whole amounts only", () => {
    expect(formatCompactCurrency(60)).not.toMatch(/\.00$/);
    expect(formatCompactCurrency(60.5)).toMatch(/\.50$/);
  });
});

describe("isOverdue", () => {
  it("is overdue when open/past-due, regardless of stored status spelling", () => {
    expect(isOverdue(invoice("open", PAST))).toBe(true);
    expect(isOverdue(invoice("overdue", PAST))).toBe(true);
  });

  it("is not overdue when the due date is still in the future", () => {
    expect(isOverdue(invoice("open", FUTURE))).toBe(false);
  });

  it("is not overdue for terminal statuses", () => {
    expect(isOverdue(invoice("paid", PAST))).toBe(false);
    expect(isOverdue(invoice("void", PAST))).toBe(false);
    expect(isOverdue(invoice("draft", PAST))).toBe(false);
  });
});

describe("invoice due-date config (single source of truth)", () => {
  it("exposes the configured default lead time", () => {
    expect(DEFAULT_INVOICE_DUE_DAYS).toBe(14);
  });

  it("computes the due date as now + lead time (ISO)", () => {
    expect(
      defaultInvoiceDueDate(new Date("2026-01-01T00:00:00.000Z")),
    ).toBe("2026-01-15T00:00:00.000Z");
  });

  it("renders the due date as YYYY-MM-DD for date inputs", () => {
    // Local-time semantics: the default must be the user's calendar day 14
    // days ahead (a UTC slice can be a day off for non-UTC users).
    const now = new Date(2026, 0, 31, 23, 30); // Jan 31, 23:30 local
    expect(defaultInvoiceDueDateInput(now)).toBe("2026-02-14");
  });
});

describe("formatDate (date-only due dates)", () => {
  it("renders the stored calendar day for UTC-midnight timestamps in any timezone", () => {
    // Due dates are created from YYYY-MM-DD inputs and stored as UTC
    // midnight — the rendered day must match what the tutor picked, not the
    // local-time conversion of the instant.
    const out = formatDate("2026-06-20T00:00:00.000Z");
    expect(out).toBe("20 Jun 2026");
  });

  it("still converts real timestamps to local time", () => {
    const out = formatDate("2026-06-20T12:00:00.000Z");
    expect(out).toContain("Jun");
    expect(out).toContain("2026");
  });
});

describe("lineItemsSubtotal (backend parity)", () => {
  it("rounds each line before summing", () => {
    // 0.125 rounds to 0.13 per line → 0.26 total; rounding the raw sum
    // (0.25) instead would give 0.25 and drift from the persisted subtotal.
    expect(
      lineItemsSubtotal([
        { unitAmount: 0.125, quantity: 1 },
        { unitAmount: 0.125, quantity: 1 },
      ]),
    ).toBe(0.26);
  });

  it("returns 0 for an empty list", () => {
    expect(lineItemsSubtotal([])).toBe(0);
  });
});

import {
  isCancelledLesson,
  isPastLesson,
  isExcludedFromInvoicing,
  isChargeableAttendance,
  partitionInvoiceableLessons,
} from "@examify-tms/shared";

describe("isCancelledLesson", () => {
  it("treats the forward flag and tutor-cancelled outcomes as cancelled", () => {
    expect(isCancelledLesson(lesson({ isCancelled: true }))).toBe(true);
    expect(
      isCancelledLesson(lesson({ attendanceStatus: "tutor_cancelled" })),
    ).toBe(true);
    expect(
      isCancelledLesson(
        lesson({ attendanceStatus: "tutor_cancelled_makeup_issued" }),
      ),
    ).toBe(true);
  });

  it("is not cancelled for ordinary outcomes", () => {
    expect(isCancelledLesson(lesson({ attendanceStatus: "present" }))).toBe(
      false,
    );
    expect(isCancelledLesson(lesson({ attendanceStatus: "unrecorded" }))).toBe(
      false,
    );
  });
});

describe("isPastLesson", () => {
  it("compares the start time to now", () => {
    expect(isPastLesson(lesson({ startDateTime: PAST }))).toBe(true);
    expect(isPastLesson(lesson({ startDateTime: FUTURE }))).toBe(false);
  });
});

describe("isExcludedFromInvoicing", () => {
  it("excludes credited/warned/tutor-cancelled outcomes", () => {
    expect(
      isExcludedFromInvoicing(lesson({ attendanceStatus: "absent_makeup_issued" })),
    ).toBe(true);
    expect(
      isExcludedFromInvoicing(lesson({ attendanceStatus: "absent_warning" })),
    ).toBe(true);
    expect(
      isExcludedFromInvoicing(lesson({ attendanceStatus: "tutor_cancelled" })),
    ).toBe(true);
    expect(
      isExcludedFromInvoicing(
        lesson({ attendanceStatus: "tutor_cancelled_makeup_issued" }),
      ),
    ).toBe(true);
  });

  it("keeps billable and unrecorded outcomes", () => {
    expect(isExcludedFromInvoicing(lesson({ attendanceStatus: "present" }))).toBe(
      false,
    );
    expect(
      isExcludedFromInvoicing(lesson({ attendanceStatus: "absent_no_makeup" })),
    ).toBe(false);
    expect(
      isExcludedFromInvoicing(lesson({ attendanceStatus: "unrecorded" })),
    ).toBe(false);
  });
});

describe("isChargeableAttendance", () => {
  it("charges attended + absent-with-no-make-up only", () => {
    expect(isChargeableAttendance(lesson({ attendanceStatus: "present" }))).toBe(
      true,
    );
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "present_late" })),
    ).toBe(true);
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "absent_no_makeup" })),
    ).toBe(true);
  });

  it("does not charge unrecorded, warned, credited or cancelled", () => {
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "unrecorded" })),
    ).toBe(false);
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "absent_warning" })),
    ).toBe(false);
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "absent_makeup_issued" })),
    ).toBe(false);
    expect(
      isChargeableAttendance(lesson({ attendanceStatus: "tutor_cancelled" })),
    ).toBe(false);
  });
});

describe("partitionInvoiceableLessons", () => {
  // Past lessons use stable 2020 dates so "past" is guaranteed; ordering
  // assertions rely on the explicit dates below.
  const chargeablePast = [
    lesson({
      id: "old",
      startDateTime: "2020-01-01T12:00:00.000Z",
      attendanceStatus: "present",
    }),
    lesson({
      id: "mid",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "present_late",
    }),
    lesson({
      id: "recent",
      startDateTime: "2020-01-03T12:00:00.000Z",
      attendanceStatus: "absent_no_makeup",
    }),
  ];
  const unrecordedPast = lesson({
    id: "unrecorded",
    startDateTime: "2020-01-02T12:00:00.000Z",
    attendanceStatus: "unrecorded",
  });
  const upcoming = [
    lesson({
      id: "far",
      startDateTime: "2099-12-01T12:00:00.000Z",
      attendanceStatus: "unrecorded",
    }),
    lesson({
      id: "soon",
      startDateTime: "2099-01-01T12:00:00.000Z",
      attendanceStatus: "unrecorded",
    }),
  ];
  const excluded = [
    lesson({
      id: "cancelled-flag",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "present",
      isCancelled: true,
    }),
    lesson({
      id: "tutor-cancelled",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "tutor_cancelled",
    }),
    lesson({
      id: "credited",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "absent_makeup_issued",
    }),
    lesson({
      id: "warned",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "absent_warning",
    }),
    lesson({
      id: "tutor-cancelled-makeup",
      startDateTime: "2020-01-02T12:00:00.000Z",
      attendanceStatus: "tutor_cancelled_makeup_issued",
    }),
  ];

  const result = partitionInvoiceableLessons([
    ...chargeablePast,
    unrecordedPast,
    ...upcoming,
    ...excluded,
  ]);

  it("drops cancelled/credited/warned/tutor-cancelled entirely", () => {
    const allIds = [
      ...result.completed.chargeable,
      ...result.completed.unrecorded,
      ...result.upcoming,
    ].map((l) => l.id);
    for (const ex of excluded) {
      expect(allIds).not.toContain(ex.id);
    }
  });

  it("groups recorded billable outcomes into completed.chargeable, newest-first", () => {
    expect(result.completed.chargeable.map((l) => l.id)).toEqual([
      "recent",
      "mid",
      "old",
    ]);
  });

  it("groups unrecorded past lessons into completed.unrecorded", () => {
    expect(result.completed.unrecorded.map((l) => l.id)).toEqual(["unrecorded"]);
  });

  it("groups future lessons into upcoming, soonest-first", () => {
    expect(result.upcoming.map((l) => l.id)).toEqual(["soon", "far"]);
  });

  it("returns empty groups for an empty list", () => {
    const empty = partitionInvoiceableLessons([]);
    expect(empty.upcoming).toEqual([]);
    expect(empty.completed.chargeable).toEqual([]);
    expect(empty.completed.unrecorded).toEqual([]);
  });

  it("never surfaces a warned absence as chargeable (the standardised rule)", () => {
    const only = partitionInvoiceableLessons([
      lesson({
        id: "warned",
        startDateTime: PAST,
        attendanceStatus: "absent_warning",
      }),
    ]);
    expect(only.completed.chargeable).toEqual([]);
    expect(only.completed.unrecorded).toEqual([]);
  });
});

