import { describe, it, expect } from "vitest";
import {
  CURRENCY_OPTIONS,
  REMINDER_LEAD_TIME_OPTIONS,
  REMINDER_DISABLED,
} from "@examify-tms/shared";

// These constants intentionally mirror backend enums (SUPPORTED_CURRENCIES /
// SUPPORTED_REMINDER_LEAD_TIMES in backend/src/services/userService.ts). The
// tests pin the expected values so any drift between client and server is
// caught here rather than at runtime.

describe("CURRENCY_OPTIONS (mirrors backend SUPPORTED_CURRENCIES)", () => {
  it("matches the backend currency list, in order", () => {
    expect(CURRENCY_OPTIONS.map((c) => c.code)).toEqual([
      "AUD",
      "USD",
      "EUR",
      "GBP",
      "NZD",
      "CAD",
      "SGD",
      "HKD",
      "INR",
      "ZAR",
      "AED",
    ]);
  });

  it("every option has a non-empty label", () => {
    for (const opt of CURRENCY_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe("REMINDER_LEAD_TIME_OPTIONS (mirrors backend SUPPORTED_REMINDER_LEAD_TIMES)", () => {
  it("matches the backend lead-time values", () => {
    expect(REMINDER_LEAD_TIME_OPTIONS.map((o) => o.value)).toEqual([
      "1_hour_before",
      "24_hours_before",
      "morning_of",
    ]);
  });

  it("every option has a non-empty label", () => {
    for (const opt of REMINDER_LEAD_TIME_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe("REMINDER_DISABLED sentinel", () => {
  it("is the documented disabled sentinel string", () => {
    expect(REMINDER_DISABLED).toBe("__disabled__");
  });
});
