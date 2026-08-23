import { describe, expect, it } from "vitest";
import {
  buildAvailability,
  buildSearchText,
  resolveProfileSubjects,
} from "../src/services/tutorProfileService";
import type { Subject, WorkingHours } from "@examify-tms/interfaces";

const catalogue: Subject[] = [
  { id: "subj_1", name: "Mathematics", color: "#2563eb" },
  { id: "subj_2", name: "Physics", color: null },
  { id: "subj_3", name: "Chemistry", color: "#16a34a" },
];

describe("resolveProfileSubjects", () => {
  it("resolves catalogue ids to full subjects with colors", () => {
    expect(resolveProfileSubjects(["subj_1", "subj_3"], [], catalogue)).toEqual([
      { id: "subj_1", name: "Mathematics", color: "#2563eb" },
      { id: "subj_3", name: "Chemistry", color: "#16a34a" },
    ]);
  });

  it("drops ids that no longer exist in the catalogue", () => {
    expect(resolveProfileSubjects(["subj_1", "subj_gone"], [], catalogue)).toEqual([
      { id: "subj_1", name: "Mathematics", color: "#2563eb" },
    ]);
  });

  it("matches legacy free-text names back into the catalogue by name", () => {
    expect(
      resolveProfileSubjects([], ["physics", "  Chemistry "], catalogue),
    ).toEqual([
      { id: "subj_2", name: "Physics", color: null },
      { id: "subj_3", name: "Chemistry", color: "#16a34a" },
    ]);
  });

  it("keeps unmatched legacy names as colorless entries", () => {
    expect(resolveProfileSubjects([], ["Biology"], catalogue)).toEqual([
      { id: "legacy:biology", name: "Biology", color: null },
    ]);
  });

  it("does not duplicate a subject present via both id and legacy name", () => {
    expect(
      resolveProfileSubjects(["subj_1"], ["mathematics"], catalogue),
    ).toEqual([{ id: "subj_1", name: "Mathematics", color: "#2563eb" }]);
  });

  it("preserves the subjectIds order over the legacy order", () => {
    expect(resolveProfileSubjects(["subj_3", "subj_1"], ["Mathematics"], catalogue)).toEqual([
      { id: "subj_3", name: "Chemistry", color: "#16a34a" },
      { id: "subj_1", name: "Mathematics", color: "#2563eb" },
    ]);
  });
});

describe("buildAvailability", () => {
  it("returns empty for null/undefined working hours", () => {
    expect(buildAvailability(null)).toEqual([]);
    expect(buildAvailability(undefined)).toEqual([]);
  });

  it("flattens configured days in monday-first order, skipping days off", () => {
    const wh: WorkingHours = {
      monday: { start: "15:30", end: "20:00" },
      tuesday: null,
      saturday: { start: "09:00", end: "12:00" },
    };
    expect(buildAvailability(wh)).toEqual([
      { day: "monday", start: "15:30", end: "20:00" },
      { day: "saturday", start: "09:00", end: "12:00" },
    ]);
  });
});

describe("buildSearchText", () => {
  it("joins name, headline and subject names lowercased", () => {
    expect(
      buildSearchText("Jane Doe", "Math Tutor", ["Mathematics", "Physics"]),
    ).toBe("jane doe math tutor mathematics physics");
  });

  it("handles a null headline", () => {
    expect(buildSearchText("Jane", null, [])).toBe("jane");
  });
});
