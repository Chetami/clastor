import { describe, it, expect } from "vitest";
import {
  minutesBetween,
  timePlusMinutes,
  eventFormSchema,
  toCreateLessonRequest,
  toCreateRecurringLessonRequest,
  describeRecurrence,
  describeOneOff,
  estimateOccurrenceCount,
} from "@examify-tms/shared";

const validOneOff = {
  studentId: "stu_1",
  studentName: "Ada Lovelace",
  date: "2026-01-15",
  startTime: "09:00",
  durationMinutes: 60,
};

const recurringSlots = [
  { dayOfWeek: "monday", timeOfDay: "09:00" },
  { dayOfWeek: "wednesday", timeOfDay: "10:00" },
];

function recurringBase(overrides: Record<string, unknown> = {}) {
  return {
    ...validOneOff,
    repeat: "weekly",
    slots: recurringSlots,
    durationMinutes: 60,
    endsMode: "until",
    endDate: "2026-12-31",
    ...overrides,
  };
}

function parse(input: Record<string, unknown>) {
  return eventFormSchema.safeParse(input);
}

describe("minutesBetween", () => {
  it("computes the minute difference between two HH:mm times", () => {
    expect(minutesBetween("09:00", "10:30")).toBe(90);
    expect(minutesBetween("00:00", "23:59")).toBe(1439);
  });

  it("is negative when the end is before the start", () => {
    expect(minutesBetween("10:00", "09:00")).toBe(-60);
  });
});

describe("timePlusMinutes", () => {
  it("adds minutes within the same day", () => {
    expect(timePlusMinutes("09:00", 90)).toBe("10:30");
  });

  it("wraps past midnight", () => {
    expect(timePlusMinutes("23:30", 60)).toBe("00:30");
  });
});

describe("eventFormSchema — one-off", () => {
  it("accepts a minimal valid lesson", () => {
    const res = parse(validOneOff);
    expect(res.success).toBe(true);
  });

  it("requires a valid date and start time", () => {
    expect(parse({ ...validOneOff, date: "15-01-2026" }).success).toBe(false);
    expect(parse({ ...validOneOff, startTime: "9:00" }).success).toBe(false);
  });

  it("requires a positive duration", () => {
    const res = parse({ ...validOneOff, durationMinutes: 0 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === "durationMinutes"),
      ).toBe(true);
    }
  });

  it("does not require a time window for a recurring series", () => {
    const res = parse({
      ...recurringBase(),
      startTime: "",
    });
    expect(res.success).toBe(true);
  });
});

describe("eventFormSchema — recurring", () => {
  it("requires at least one slot", () => {
    const res = parse({ ...recurringBase(), slots: [] });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "slots")).toBe(true);
    }
  });

  it("requires a valid time on every slot", () => {
    const res = parse({
      ...recurringBase(),
      slots: [
        { dayOfWeek: "monday", timeOfDay: "09:00" },
        { dayOfWeek: "wednesday", timeOfDay: "bad" },
      ],
    });
    expect(res.success).toBe(false);
  });

  it("requires an end date when endsMode is 'until'", () => {
    const res = parse({ ...recurringBase(), endDate: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "endDate")).toBe(true);
    }
  });

  it("requires an occurrence count when endsMode is 'count'", () => {
    const res = parse({ ...recurringBase(), endsMode: "count" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === "occurrenceCount"),
      ).toBe(true);
    }
  });
});

describe("toCreateLessonRequest", () => {
  it("builds a one-off create payload using the explicit duration + ISO start", () => {
    const parsed = eventFormSchema.parse({ ...validOneOff, durationMinutes: 45 });
    const req = toCreateLessonRequest(parsed);
    expect(req.studentId).toBe("stu_1");
    expect(req.durationMinutes).toBe(45);
    // The builder parses "<date>T<time>:00" in local time, so mirror that here.
    expect(req.startDateTime).toBe(
      new Date("2026-01-15T09:00:00").toISOString(),
    );
    expect(req.subject).toBeNull();
    expect(req.location).toBeNull();
    expect(req.notes).toBeNull();
    expect(req.remindersEnabled).toBe(true);
  });

  it("fills subject/location/notes from trimmed values", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      subject: "  Maths  ",
      location: "  Online  ",
      notes: "  bring calculator  ",
    });
    const req = toCreateLessonRequest(parsed);
    expect(req.subject).toBe("Maths");
    expect(req.location).toBe("Online");
    expect(req.notes).toBe("bring calculator");
  });
});

describe("toCreateRecurringLessonRequest", () => {
  it("uses the explicit duration and builds a slot per row", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      repeat: "weekly",
      slots: recurringSlots,
      durationMinutes: 45,
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const req = toCreateRecurringLessonRequest(parsed, "Australia/Sydney");
    expect(req.intervalWeeks).toBe(1);
    expect(req.durationMinutes).toBe(45);
    expect(req.slots).toEqual([
      { dayOfWeek: "monday", timeOfDay: "09:00" },
      { dayOfWeek: "wednesday", timeOfDay: "10:00" },
    ]);
    expect(req.timezone).toBe("Australia/Sydney");
    expect(req.until).toBe("2026-12-31");
    expect(req.count).toBeNull();
  });

  it("maps biweekly → 2-week interval and honours count mode", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      repeat: "biweekly",
      slots: [{ dayOfWeek: "friday", timeOfDay: "16:00" }],
      durationMinutes: 60,
      endsMode: "count",
      occurrenceCount: 6,
    });
    const req = toCreateRecurringLessonRequest(parsed, "UTC");
    expect(req.intervalWeeks).toBe(2);
    expect(req.until).toBeNull();
    expect(req.count).toBe(6);
  });

  it("maps monthly → 4-week interval", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      repeat: "monthly",
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const req = toCreateRecurringLessonRequest(parsed, "UTC");
    expect(req.intervalWeeks).toBe(4);
    expect(req.until).toBe("2026-12-31");
  });
});

describe("estimateOccurrenceCount", () => {
  it("returns null for a one-off", () => {
    expect(
      estimateOccurrenceCount(eventFormSchema.parse(validOneOff)),
    ).toBeNull();
  });

  it("returns the count in count mode", () => {
    const parsed = eventFormSchema.parse({
      ...recurringBase(),
      endsMode: "count",
      occurrenceCount: 12,
    });
    expect(estimateOccurrenceCount(parsed)).toBe(12);
  });

  it("estimates from the date range for until mode", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "weekly",
      slots: recurringSlots,
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-01-31",
    });
    // ~4 on-weeks × 2 slots.
    expect(estimateOccurrenceCount(parsed)).toBeGreaterThanOrEqual(8);
  });
});

describe("describeRecurrence", () => {
  it("restates a weekly multi-slot series in plain English", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "weekly",
      slots: [
        { dayOfWeek: "monday", timeOfDay: "16:00" },
        { dayOfWeek: "wednesday", timeOfDay: "17:00" },
      ],
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const summary = describeRecurrence(parsed);
    expect(summary).toContain("Every week");
    expect(summary).toContain("Monday 4:00 PM");
    expect(summary).toContain("Wednesday 5:00 PM");
    expect(summary).toContain("60 min each");
  });

  it("returns an empty string for a one-off", () => {
    expect(describeRecurrence(eventFormSchema.parse(validOneOff))).toBe("");
  });
});

describe("describeOneOff", () => {
  it("restates a one-off lesson with start, derived end and duration", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      startTime: "16:00",
      durationMinutes: 60,
    });
    const summary = describeOneOff(parsed);
    expect(summary).toContain("4:00 PM");
    expect(summary).toContain("5:00 PM");
    expect(summary).toContain("60 min");
  });

  it("returns an empty string when the start time is missing", () => {
    const parsed = eventFormSchema.parse(validOneOff);
    expect(describeOneOff({ ...parsed, startTime: "" })).toBe("");
  });

  it("returns an empty string for a recurring series", () => {
    expect(describeOneOff(eventFormSchema.parse(recurringBase()))).toBe("");
  });
});
