import { describe, expect, it } from "vitest";
import {
  STEP_KEYS,
  resolveInitialStep,
  resolveStepIndex,
  resolveStepProgress,
} from "./onboarding-steps";

const STEPS_WITHOUT_GOOGLE = STEP_KEYS.filter((k) => k !== "google");

function params(...entries: [string, string][]): URLSearchParams {
  return new URLSearchParams(entries);
}

describe("resolveInitialStep", () => {
  it("starts a brand-new Google signup at the stored step (welcome), not the calendar step", () => {
    // Regression: honoring ?google unconditionally resolved past the
    // filtered-out calendar step and skipped the whole wizard.
    const step = resolveInitialStep(params(["google", "connected"]), "welcome");
    expect(step).toBe("welcome");
    expect(resolveStepIndex(step, STEPS_WITHOUT_GOOGLE)).toBe(0);
  });

  it("resumes on the calendar step when returning from consent mid-wizard", () => {
    const step = resolveInitialStep(params(["google", "connected"]), "google");
    expect(step).toBe("google");
  });

  it("honors the google param for any stored step at or after the calendar step", () => {
    expect(
      resolveInitialStep(params(["google", "connected"]), "finish"),
    ).toBe("google");
  });

  it("ignores the google param before the calendar step", () => {
    expect(resolveInitialStep(params(["google", "connected"]), "student")).toBe(
      "student",
    );
  });

  it("falls back to the stored step without a google param", () => {
    expect(resolveInitialStep(params(), "lesson")).toBe("lesson");
  });
});

describe("resolveStepIndex", () => {
  it("returns the direct index when the step is visible", () => {
    expect(resolveStepIndex("student", STEP_KEYS)).toBe(2);
  });

  it("lands on the first surviving step after a removed one", () => {
    // google removed → resuming there lands on finish
    expect(resolveStepIndex("google", STEPS_WITHOUT_GOOGLE)).toBe(
      STEPS_WITHOUT_GOOGLE.length - 1,
    );
    expect(STEPS_WITHOUT_GOOGLE[STEPS_WITHOUT_GOOGLE.length - 1]).toBe(
      "finish",
    );
  });

  it("keeps a welcome resume at welcome even when google is filtered out", () => {
    expect(resolveStepIndex("welcome", STEPS_WITHOUT_GOOGLE)).toBe(0);
  });
});

describe("resolveStepProgress", () => {
  it("shows an untouched bar on welcome", () => {
    expect(resolveStepProgress("welcome", STEP_KEYS)).toEqual({
      label: null,
      value: 0,
    });
  });

  it("counts only working steps in the label and bar", () => {
    expect(resolveStepProgress("subjects", STEP_KEYS)).toEqual({
      label: "Step 1 of 4",
      value: 25,
    });
    expect(resolveStepProgress("student", STEP_KEYS).label).toBe(
      "Step 2 of 4",
    );
    expect(resolveStepProgress("google", STEP_KEYS)).toEqual({
      label: "Step 4 of 4",
      value: 100,
    });
  });

  it("shows a full bar on finish", () => {
    expect(resolveStepProgress("finish", STEP_KEYS)).toEqual({
      label: null,
      value: 100,
    });
  });

  it("renumbers over the working steps when google is filtered out", () => {
    expect(resolveStepProgress("lesson", STEPS_WITHOUT_GOOGLE)).toEqual({
      label: "Step 3 of 3",
      value: 100,
    });
    expect(resolveStepProgress("welcome", STEPS_WITHOUT_GOOGLE).value).toBe(0);
  });
});
