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

describe("formatDate", () => {
  it("renders the month and year regardless of timezone", () => {
    // Noon UTC on June 20 is still June 20 in every timezone.
    const out = formatDate("2026-06-20T12:00:00.000Z");
    expect(out).toContain("Jun");
    expect(out).toContain("2026");
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
    expect(
      defaultInvoiceDueDateInput(new Date("2026-01-01T00:00:00.000Z")),
    ).toBe("2026-01-15");
  });
});
