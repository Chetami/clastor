import { describe, it, expect } from "vitest";
import type { WorkingHours } from "@examify-tms/interfaces";
import {
  toMinutes,
  windowForDate,
  isSlotOutsideWorkingHours,
  DEFAULT_WORKING_HOURS,
  WORKING_DAYS,
} from "@examify-tms/shared";

describe("toMinutes", () => {
  it("parses canonical HH:mm into minutes since midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("12:00")).toBe(720);
    expect(toMinutes("20:00")).toBe(1200);
  });

  it("returns NaN for malformed shapes", () => {
    expect(toMinutes("9:00")).toBeNaN(); // not zero-padded
    expect(toMinutes("abc")).toBeNaN();
    expect(toMinutes("24:00")).toBeNaN(); // out of range
    expect(toMinutes("12:60")).toBeNaN(); // invalid minutes
  });
});

describe("windowForDate", () => {
  const wh: WorkingHours = {
    ...DEFAULT_WORKING_HOURS,
    saturday: { start: "08:00", end: "12:00" },
  };

  // 2024-01-01 was a Monday; 2024-01-06 was a Saturday; 2024-01-07 a Sunday.
  it("returns the window for a weekday", () => {
    expect(windowForDate(new Date(2024, 0, 1), wh)).toEqual({
      start: "12:00",
      end: "20:00",
    });
  });

  it("returns the window for a configured weekend day", () => {
    expect(windowForDate(new Date(2024, 0, 6), wh)).toEqual({
      start: "08:00",
      end: "12:00",
    });
  });

  it("returns null on a day off", () => {
    expect(windowForDate(new Date(2024, 0, 7), wh)).toBeNull(); // sunday off
  });
});

describe("isSlotOutsideWorkingHours", () => {
  const wh: WorkingHours = DEFAULT_WORKING_HOURS; // Mon–Fri 12:00–20:00

  it("returns false when working hours aren't configured", () => {
    expect(isSlotOutsideWorkingHours("2024-01-01", "09:00", "10:00", null)).toBe(
      false,
    );
    expect(isSlotOutsideWorkingHours("2024-01-01", "09:00", "10:00", undefined)).toBe(
      false,
    );
  });

  it("returns false for an invalid date", () => {
    expect(isSlotOutsideWorkingHours("not-a-date", "12:00", "13:00", wh)).toBe(
      false,
    );
  });

  it("is inside when the slot fits entirely within the window", () => {
    // Monday 2024-01-01, 13:00–14:00 fits within 12:00–20:00.
    expect(isSlotOutsideWorkingHours("2024-01-01", "13:00", "14:00", wh)).toBe(
      false,
    );
  });

  it("is outside when the slot starts before the window", () => {
    expect(isSlotOutsideWorkingHours("2024-01-01", "11:00", "13:00", wh)).toBe(
      true,
    );
  });

  it("is outside when the slot ends after the window", () => {
    expect(isSlotOutsideWorkingHours("2024-01-01", "19:00", "21:00", wh)).toBe(
      true,
    );
  });

  it("is outside on a day with no configured window", () => {
    // Sunday 2024-01-07 is a day off in the default hours.
    expect(isSlotOutsideWorkingHours("2024-01-07", "12:00", "13:00", wh)).toBe(
      true,
    );
  });
});

describe("DEFAULT_WORKING_HOURS / WORKING_DAYS", () => {
  it("enables Mon–Fri 12:00–20:00 and leaves the weekend off", () => {
    expect(DEFAULT_WORKING_HOURS.saturday).toBeNull();
    expect(DEFAULT_WORKING_HOURS.sunday).toBeNull();
    expect(DEFAULT_WORKING_HOURS.monday).toEqual({ start: "12:00", end: "20:00" });
  });

  it("is Monday-first", () => {
    expect(WORKING_DAYS[0]).toBe("monday");
    expect(WORKING_DAYS[WORKING_DAYS.length - 1]).toBe("sunday");
  });
});
