import { describe, it, expect } from "vitest";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import { getCtaLabel, formatProfileRate } from "@examify-tms/shared";

function profile(
  overrides: Partial<PublicTutorProfileResponse> = {},
): PublicTutorProfileResponse {
  return {
    ctaText: null,
    hourlyRate: null,
    currency: "AUD",
    ...overrides,
  } as unknown as PublicTutorProfileResponse;
}

describe("getCtaLabel", () => {
  it("uses an explicit CTA when provided (trimmed)", () => {
    expect(getCtaLabel(profile({ ctaText: "  Book now  " }))).toBe("Book now");
  });

  it("falls back to 'Get in touch' when blank or missing", () => {
    expect(getCtaLabel(profile({ ctaText: "" }))).toBe("Get in touch");
    expect(getCtaLabel(profile({ ctaText: "   " }))).toBe("Get in touch");
    expect(getCtaLabel(profile({ ctaText: null }))).toBe("Get in touch");
  });
});

describe("formatProfileRate", () => {
  it("returns null when no rate is set", () => {
    expect(formatProfileRate(profile({ hourlyRate: null }))).toBeNull();
  });

  it("formats '<currency> <amount>' to 2 decimals", () => {
    expect(
      formatProfileRate(profile({ hourlyRate: 45, currency: "USD" })),
    ).toBe("USD 45.00");
    expect(
      formatProfileRate(profile({ hourlyRate: 50.5, currency: "AUD" })),
    ).toBe("AUD 50.50");
  });

  it("coerces numeric strings", () => {
    expect(
      formatProfileRate(profile({ hourlyRate: "50", currency: "EUR" })),
    ).toBe("EUR 50.00");
  });
});
