import { describe, it, expect } from "vitest";
import {
  minutesBetween,
  eventFormSchema,
  toCreateLessonRequest,
  toCreateRecurringLessonRequest,
} from "@examify-tms/shared";

const validOneOff = {
  studentId: "stu_1",
  studentName: "Ada Lovelace",
  date: "2026-01-15",
  startTime: "09:00",
  endTime: "10:00",
};

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

describe("eventFormSchema — one-off", () => {
  it("accepts a minimal valid lesson", () => {
    const res = parse(validOneOff);
    expect(res.success).toBe(true);
  });

  it("requires a valid date and HH:mm times", () => {
    expect(
      parse({ ...validOneOff, date: "15-01-2026" }).success,
    ).toBe(false);
    expect(parse({ ...validOneOff, startTime: "9:00" }).success).toBe(false);
  });
});

describe("eventFormSchema — end after start", () => {
  it("rejects an end time at or before the start", () => {
    const same = parse({ ...validOneOff, startTime: "09:30", endTime: "09:30" });
    expect(same.success).toBe(false);
    if (!same.success) {
      expect(same.error.issues.some((i) => i.path[0] === "endTime")).toBe(true);
    }
  });
});

describe("eventFormSchema — recurring", () => {
  const recurringBase = {
    ...validOneOff,
    repeat: "weekly" as const,
    selectedDays: ["monday", "wednesday"],
    slotTimes: { monday: "09:00", wednesday: "10:00" },
    endsMode: "until" as const,
    endDate: "2026-12-31",
  };

  it("requires at least one day", () => {
    const res = parse({ ...recurringBase, selectedDays: [] });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === "selectedDays"),
      ).toBe(true);
    }
  });

  it("requires a valid slot time for each selected day", () => {
    const res = parse({
      ...recurringBase,
      slotTimes: { monday: "09:00", wednesday: "bad" },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === "slotTimes"),
      ).toBe(true);
    }
  });

  it("requires an end date when endsMode is 'until'", () => {
    const res = parse({ ...recurringBase, endDate: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "endDate")).toBe(true);
    }
  });

  it("requires an occurrence count when endsMode is 'count'", () => {
    const res = parse({ ...recurringBase, endsMode: "count" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === "occurrenceCount"),
      ).toBe(true);
    }
  });
});

describe("toCreateLessonRequest", () => {
  it("builds a one-off create payload with derived duration + ISO start", () => {
    const parsed = eventFormSchema.parse(validOneOff);
    const req = toCreateLessonRequest(parsed);
    expect(req.studentId).toBe("stu_1");
    expect(req.durationMinutes).toBe(60);
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
  it("maps weekly → 1-week interval and builds a slot per day", () => {
    const parsed = eventFormSchema.parse({
      ...validOneOff,
      repeat: "weekly",
      selectedDays: ["monday", "wednesday"],
      slotTimes: { monday: "09:00", wednesday: "10:00" },
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const req = toCreateRecurringLessonRequest(parsed, "Australia/Sydney");
    expect(req.intervalWeeks).toBe(1);
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
      selectedDays: ["friday"],
      slotTimes: { friday: "16:00" },
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
      selectedDays: ["monday"],
      slotTimes: { monday: "09:00" },
      endsMode: "until",
      endDate: "2026-12-31",
    });
    const req = toCreateRecurringLessonRequest(parsed, "UTC");
    expect(req.intervalWeeks).toBe(4);
    expect(req.until).toBe("2026-12-31");
  });
});
