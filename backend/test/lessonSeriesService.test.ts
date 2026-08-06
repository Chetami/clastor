import { describe, expect, it } from "vitest";
import { generateOccurrences } from "../src/services/lessonSeriesService";

/**
 * `generateOccurrences` is the recurrence engine behind series creation: it
 * expands a rule into concrete lesson start times. It's pure (given a rule),
 * so we drive it with a fixed UTC timezone and compare ISO instants.
 */
function iso(d: Date) {
  return d.toISOString();
}

describe("generateOccurrences", () => {
  it("expands a weekly single-slot rule up to an inclusive end date", () => {
    const occ = generateOccurrences({
      startDate: "2026-01-05", // Monday
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      until: "2026-01-31",
      count: null,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-12T09:00:00.000Z",
      "2026-01-19T09:00:00.000Z",
      "2026-01-26T09:00:00.000Z",
    ]);
  });

  it("honours an explicit occurrence count over a date range", () => {
    const occ = generateOccurrences({
      startDate: "2026-01-05",
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      until: null,
      count: 3,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-12T09:00:00.000Z",
      "2026-01-19T09:00:00.000Z",
    ]);
  });

  it("steps by intervalWeeks for a fortnightly series", () => {
    const occ = generateOccurrences({
      startDate: "2026-01-02", // Friday
      timezone: "UTC",
      intervalWeeks: 2,
      slots: [{ dayOfWeek: "friday", timeOfDay: "16:00" }],
      until: "2026-02-27",
      count: null,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-02T16:00:00.000Z",
      "2026-01-16T16:00:00.000Z",
      "2026-01-30T16:00:00.000Z",
      "2026-02-13T16:00:00.000Z",
      "2026-02-27T16:00:00.000Z",
    ]);
  });

  it("emits each slot per on-week and orders them by day-of-week", () => {
    // Slots given out of order; output must be Mon then Wed within each week.
    const occ = generateOccurrences({
      startDate: "2026-01-05",
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [
        { dayOfWeek: "wednesday", timeOfDay: "10:00" },
        { dayOfWeek: "monday", timeOfDay: "09:00" },
      ],
      until: null,
      count: 4,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-07T10:00:00.000Z",
      "2026-01-12T09:00:00.000Z",
      "2026-01-14T10:00:00.000Z",
    ]);
  });

  it("caps a multi-slot week at the requested count", () => {
    const occ = generateOccurrences({
      startDate: "2026-01-05",
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [
        { dayOfWeek: "monday", timeOfDay: "09:00" },
        { dayOfWeek: "wednesday", timeOfDay: "10:00" },
      ],
      until: null,
      count: 2,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-07T10:00:00.000Z",
    ]);
  });

  it("drops slots that fall before the anchor start date", () => {
    // Starts on a Thursday; the Monday in the anchor week is before the start.
    const occ = generateOccurrences({
      startDate: "2026-01-08", // Thursday
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
      until: "2026-01-31",
      count: null,
    });
    expect(occ.map(iso)).toEqual([
      "2026-01-12T09:00:00.000Z",
      "2026-01-19T09:00:00.000Z",
      "2026-01-26T09:00:00.000Z",
    ]);
  });

  it("returns nothing when there are no slots", () => {
    const occ = generateOccurrences({
      startDate: "2026-01-05",
      timezone: "UTC",
      intervalWeeks: 1,
      slots: [],
      until: "2026-12-31",
      count: null,
    });
    expect(occ).toEqual([]);
  });
});
