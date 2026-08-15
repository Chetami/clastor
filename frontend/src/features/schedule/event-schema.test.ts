import { describe, it, expect } from "vitest";
import {
  minutesBetween,
  timePlusMinutes,
  intervalWeeksFor,
  formatTime12h,
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

  it("leaves the time unchanged for zero minutes", () => {
    expect(timePlusMinutes("09:00", 0)).toBe("09:00");
  });

  it("advances by exactly one hour", () => {
    expect(timePlusMinutes("09:00", 60)).toBe("10:00");
  });
});

describe("intervalWeeksFor", () => {
  it("maps each cadence to its week interval", () => {
    expect(intervalWeeksFor("weekly")).toBe(1);
    expect(intervalWeeksFor("biweekly")).toBe(2);
    expect(intervalWeeksFor("monthly")).toBe(4);
    // "none" isn't a real cadence but falls back to 1.
    expect(intervalWeeksFor("none")).toBe(1);
  });
});

describe("formatTime12h", () => {
  it("formats morning times with AM", () => {
    expect(formatTime12h("09:05")).toBe("9:05 AM");
    expect(formatTime12h("00:00")).toBe("12:00 AM");
  });

  it("formats afternoon/evening times with PM", () => {
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("13:30")).toBe("1:30 PM");
    expect(formatTime12h("23:59")).toBe("11:59 PM");
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

  it("rejects a negative duration", () => {
    expect(parse({ ...validOneOff, durationMinutes: -10 }).success).toBe(false);
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

  it("accepts a complete count-mode series", () => {
    const res = parse({
      ...recurringBase(),
      endsMode: "count",
      occurrenceCount: 10,
    });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid day-of-week on a slot", () => {
    const res = parse({
      ...recurringBase(),
      slots: [{ dayOfWeek: "funday" as unknown as string, timeOfDay: "09:00" }],
    });
    expect(res.success).toBe(false);
  });

  it("rejects duplicate day+time slots", () => {
    const res = parse({
      ...recurringBase(),
      slots: [
        { dayOfWeek: "monday", timeOfDay: "09:00" },
        { dayOfWeek: "monday", timeOfDay: "09:00" },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "slots")).toBe(true);
    }
  });

  it("allows the same day at different times, and the same time on different days", () => {
    const res = parse({
      ...recurringBase(),
      slots: [
        { dayOfWeek: "monday", timeOfDay: "09:00" },
        { dayOfWeek: "monday", timeOfDay: "10:00" },
        { dayOfWeek: "wednesday", timeOfDay: "09:00" },
      ],
    });
    expect(res.success).toBe(true);
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

  it("halves the estimate for a fortnightly cadence", () => {
    const weekly = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "weekly",
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-03-30",
    });
    const biweekly = eventFormSchema.parse({
      ...weekly,
      repeat: "biweekly",
    });
    const weeklyCount = estimateOccurrenceCount(weekly);
    const biweeklyCount = estimateOccurrenceCount(biweekly);
    expect(weeklyCount).not.toBeNull();
    expect(biweeklyCount).not.toBeNull();
    expect(biweeklyCount!).toBeLessThan(weeklyCount!);
  });

  it("returns null when the end date is before the start", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-02-01",
      repeat: "weekly",
      slots: recurringSlots,
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-01-01",
    });
    expect(estimateOccurrenceCount(parsed)).toBeNull();
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

  it("handles a single slot", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "weekly",
      slots: [{ dayOfWeek: "friday", timeOfDay: "16:00" }],
      durationMinutes: 45,
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const summary = describeRecurrence(parsed);
    expect(summary).toContain("Friday 4:00 PM");
    expect(summary).toContain("45 min each");
    // No stray comma-joiners for a single slot.
    expect(summary).not.toContain("&");
  });

  it("uses the fortnightly cadence label", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "biweekly",
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      durationMinutes: 60,
      endsMode: "until",
      endDate: "2026-12-31",
    });
    expect(describeRecurrence(parsed)).toContain("Every 2 weeks");
  });

  it("restates a count-bounded series", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      date: "2026-01-05",
      repeat: "weekly",
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      durationMinutes: 60,
      endsMode: "count",
      occurrenceCount: 10,
    });
    expect(describeRecurrence(parsed)).toContain("for 10 lessons");
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

  it("includes the year so the date is unambiguous", () => {
    const parsed = eventFormSchema.parse(validOneOff);
    expect(describeOneOff(parsed)).toContain("2026");
  });

  it("returns an empty string when the start time is missing", () => {
    const parsed = eventFormSchema.parse(validOneOff);
    expect(describeOneOff({ ...parsed, startTime: "" })).toBe("");
  });

  it("returns an empty string for a recurring series", () => {
    expect(describeOneOff(eventFormSchema.parse(recurringBase()))).toBe("");
  });
});
