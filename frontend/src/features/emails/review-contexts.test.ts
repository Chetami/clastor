import { describe, it, expect } from "vitest";
import {
  EMAIL_SEND_CONTEXTS,
  shouldSkipReview,
} from "@examify-tms/shared";
import type { EmailReviewSettings } from "@examify-tms/interfaces";

describe("EMAIL_SEND_CONTEXTS", () => {
  it("marks attendance-marking as a background-send exception", () => {
    expect(EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.background).toBe(true);
  });

  it("marks known review surfaces as non-background", () => {
    expect(EMAIL_SEND_CONTEXTS.INVOICE_CREATE.background).toBe(false);
    expect(EMAIL_SEND_CONTEXTS.INVOICE_RESEND.background).toBe(false);
    expect(EMAIL_SEND_CONTEXTS.LESSON_ROW_SEND.background).toBe(false);
    expect(EMAIL_SEND_CONTEXTS.CALENDAR_POPOVER_SEND.background).toBe(false);
  });

  it("gives every entry a unique key", () => {
    const keys = Object.values(EMAIL_SEND_CONTEXTS).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("shouldSkipReview", () => {
  describe("default (review enabled) — only background contexts skip", () => {
    it("skips for a background context (attendance-marking)", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.key,
          null,
        ),
      ).toBe(true);
    });

    it("skips for a background context when settings are undefined", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.key,
          undefined,
        ),
      ).toBe(true);
    });

    it("does NOT skip for a review context (invoice-create)", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.INVOICE_CREATE.key,
          null,
        ),
      ).toBe(false);
    });

    it("does NOT skip when no context is given", () => {
      expect(shouldSkipReview(undefined, null)).toBe(false);
    });
  });

  describe("explicit reviewEnabled: true — behaves like default", () => {
    const enabled: EmailReviewSettings = { reviewEnabled: true };

    it("skips for a background context", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.key,
          enabled,
        ),
      ).toBe(true);
    });

    it("does NOT skip for a review context", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.INVOICE_RESEND.key,
          enabled,
        ),
      ).toBe(false);
    });
  });

  describe("global kill switch — reviewEnabled: false skips everything", () => {
    const disabled: EmailReviewSettings = { reviewEnabled: false };

    it("skips a normally-review context", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.INVOICE_CREATE.key,
          disabled,
        ),
      ).toBe(true);
    });

    it("skips a background context", () => {
      expect(
        shouldSkipReview(
          EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.key,
          disabled,
        ),
      ).toBe(true);
    });

    it("skips even when no context is given", () => {
      expect(shouldSkipReview(undefined, disabled)).toBe(true);
    });

    it("skips for an unknown context key", () => {
      expect(
        shouldSkipReview("some-future-context" as never, disabled),
      ).toBe(true);
    });
  });

  describe("unknown context keys", () => {
    it("does NOT skip an unknown key with default settings", () => {
      expect(shouldSkipReview("unknown" as never, null)).toBe(false);
    });
  });
});
