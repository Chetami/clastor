import { describe, it, expect } from "vitest";
import {
  formatProfileTime,
  formatAvailabilitySlot,
  formatWorkingHours,
  formatYearsExperience,
  formatRating,
} from "@examify-tms/shared";
import type { AvailabilitySlot, WorkingHours } from "@examify-tms/interfaces";

describe("formatProfileTime", () => {
  it("converts 24h HH:mm to 12h with am/pm", () => {
    expect(formatProfileTime("00:00")).toBe("12:00am");
    expect(formatProfileTime("09:05")).toBe("9:05am");
    expect(formatProfileTime("12:00")).toBe("12:00pm");
    expect(formatProfileTime("15:30")).toBe("3:30pm");
    expect(formatProfileTime("20:00")).toBe("8:00pm");
  });

  it("passes through malformed values", () => {
    expect(formatProfileTime("whenever")).toBe("whenever");
  });
});

describe("formatAvailabilitySlot", () => {
  it("formats 'Mon · 3:30pm – 8:00pm'", () => {
    const slot: AvailabilitySlot = {
      day: "monday",
      start: "15:30",
      end: "20:00",
    };
    expect(formatAvailabilitySlot(slot)).toBe("Mon · 3:30pm – 8:00pm");
  });
});

describe("formatWorkingHours", () => {
  it("returns an empty array for null working hours", () => {
    expect(formatWorkingHours(null)).toEqual([]);
  });

  it("formats configured days in monday-first order, skipping days off", () => {
    const wh: WorkingHours = {
      monday: { start: "15:30", end: "20:00" },
      tuesday: null,
      saturday: { start: "09:00", end: "12:00" },
    };
    expect(formatWorkingHours(wh)).toEqual([
      "Mon · 3:30pm – 8:00pm",
      "Sat · 9:00am – 12:00pm",
    ]);
  });
});

describe("formatYearsExperience", () => {
  it("singularises one year", () => {
    expect(formatYearsExperience(1)).toBe("1 year tutoring");
  });

  it("pluralises multiple years", () => {
    expect(formatYearsExperience(8)).toBe("8 years tutoring");
  });

  it("returns null when not provided", () => {
    expect(formatYearsExperience(null)).toBeNull();
    expect(formatYearsExperience(undefined)).toBeNull();
  });
});

describe("formatRating", () => {
  it("formats to one decimal", () => {
    expect(formatRating(4.75)).toBe("4.8");
    expect(formatRating(5)).toBe("5.0");
  });

  it("returns null when there are no reviews", () => {
    expect(formatRating(null)).toBeNull();
    expect(formatRating(undefined)).toBeNull();
  });
});
