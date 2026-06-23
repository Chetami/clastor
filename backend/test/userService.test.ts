import { describe, expect, it } from "vitest";
import { normalizeWorkingHours } from "../src/services/userService";
import type { WorkingHours } from "@examify-tms/interfaces";

const ALL_DAYS: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function window(start: string, end: string) {
  return { start, end };
}

describe("normalizeWorkingHours", () => {
  describe("absent / empty input", () => {
    it("returns null for null", () => {
      expect(normalizeWorkingHours(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(normalizeWorkingHours(undefined)).toBeNull();
    });

    it("returns null for non-object input", () => {
      expect(normalizeWorkingHours("09:00-17:00")).toBeNull();
      expect(normalizeWorkingHours(42)).toBeNull();
    });

    it("returns null for an empty object (no day enabled)", () => {
      expect(normalizeWorkingHours({})).toBeNull();
    });

    it("returns null when every day is explicitly off", () => {
      const allOff = {} as WorkingHours;
      for (const d of ALL_DAYS) allOff[d] = null;
      expect(normalizeWorkingHours(allOff)).toBeNull();
    });
  });

  describe("valid input", () => {
    // The exact input captured from the bug report: one valid day, rest null.
    // Previously this was normalized to null (deleting the field) because the
    // time parser returned NaN for every value.
    it("regression: a single valid day survives normalization", () => {
      const input = {
        monday: window("09:00", "17:00"),
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
      } as WorkingHours;

      const result = normalizeWorkingHours(input);
      expect(result).not.toBeNull();
      expect(result!.monday).toEqual(window("09:00", "17:00"));
      for (const d of ALL_DAYS.filter((x) => x !== "monday")) {
        expect(result![d]).toBeNull();
      }
    });

    it("keeps multiple valid days and nulls the rest", () => {
      const input = {
        monday: window("09:00", "17:00"),
        wednesday: window("10:00", "18:00"),
        friday: window("08:30", "12:00"),
        tuesday: null,
        thursday: null,
        saturday: null,
        sunday: null,
      } as WorkingHours;

      const result = normalizeWorkingHours(input);
      expect(result).toEqual({
        monday: window("09:00", "17:00"),
        tuesday: null,
        wednesday: window("10:00", "18:00"),
        thursday: null,
        friday: window("08:30", "12:00"),
        saturday: null,
        sunday: null,
      });
    });

    it("accepts the full-day boundary window 00:00-23:59", () => {
      const input = { monday: window("00:00", "23:59") } as WorkingHours;
      const result = normalizeWorkingHours(input);
      expect(result).not.toBeNull();
      expect(result!.monday).toEqual(window("00:00", "23:59"));
    });
  });

  describe("invalid time formats", () => {
    const badTimes = ["9:00", "24:00", "09:60", "abc", "0900", "09-00", "12:00:00"];
      for (const bad of badTimes) {
        it(`rejects malformed start "${bad}" (day becomes null)`, () => {
          const input = {
            monday: window(bad, "17:00"),
            tuesday: window("09:00", "17:00"),
          } as WorkingHours;
          const result = normalizeWorkingHours(input);
          expect(result).not.toBeNull(); // tuesday still valid
          expect(result!.monday).toBeNull();
          expect(result!.tuesday).toEqual(window("09:00", "17:00"));
        });

        it(`rejects malformed end "${bad}" (day becomes null)`, () => {
          const input = {
            monday: window("09:00", bad),
          } as WorkingHours;
          const result = normalizeWorkingHours(input);
          expect(result).toBeNull(); // no valid day left
        });
      }
  });

  describe("window ordering", () => {
    it("rejects start === end", () => {
      const input = { monday: window("09:00", "09:00") } as WorkingHours;
      expect(normalizeWorkingHours(input)).toBeNull();
    });

    it("rejects start > end", () => {
      const input = { monday: window("17:00", "09:00") } as WorkingHours;
      expect(normalizeWorkingHours(input)).toBeNull();
    });
  });

  describe("garbage entry shapes", () => {
    it("treats non-object day entries as a day off", () => {
      const input = {
        monday: "09:00-17:00", // string, not a window
        tuesday: 42,
        wednesday: window("09:00", "17:00"),
      } as unknown as WorkingHours;

      const result = normalizeWorkingHours(input);
      expect(result).not.toBeNull();
      expect(result!.monday).toBeNull();
      expect(result!.tuesday).toBeNull();
      expect(result!.wednesday).toEqual(window("09:00", "17:00"));
    });
  });

  describe("idempotency (round-trip stability)", () => {
    const sample = {
      monday: window("09:00", "17:00"),
      tuesday: window("10:00", "18:00"),
      wednesday: null,
      thursday: window("08:00", "20:00"),
      friday: null,
      saturday: window("09:00", "13:00"),
      sunday: null,
    } as WorkingHours;

    it("normalize(normalize(x)) === normalize(x)", () => {
      const once = normalizeWorkingHours(sample);
      const twice = normalizeWorkingHours(once);
      expect(twice).toEqual(once);
    });
  });
});
