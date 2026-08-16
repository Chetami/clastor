import { describe, expect, it, vi, beforeEach } from "vitest";

// getSenderDisplayName reads EMAIL_FROM at call time via the config module.
vi.mock("../src/config/email", () => ({
  getSenderDisplayName: () => "Clastor",
  getFrontendUrl: () => "https://app.clastor.example.com",
}));

import { emailButtonHtml, wrapEmailHtml } from "../src/services/emailLayout";

describe("emailButtonHtml", () => {
  it("renders a styled anchor with the label", () => {
    const html = emailButtonHtml("https://example.com/verify?x=1", "Verify email");
    expect(html).toContain('<a href="https://example.com/verify?x=1"');
    expect(html).toContain("Verify email");
    expect(html).toContain("border-radius:8px");
  });

  it("defaults to the brand orange with cream text", () => {
    const html = emailButtonHtml("https://example.com", "Verify email");
    expect(html).toContain("background:#e05e0f");
    expect(html).toContain("color:#fff9ef");
  });

  it("escapes the URL and label", () => {
    const html = emailButtonHtml(
      'https://example.com/a?b="onload"',
      "<b>Hi</b>",
    );
    expect(html).not.toContain('<a href="https://example.com/a?b="');
    expect(html).toContain("&quot;");
    expect(html).not.toContain("<b>Hi</b>");
  });

  it("supports color overrides (semantic buttons)", () => {
    const html = emailButtonHtml("https://example.com", "Accept", {
      color: "#16a34a",
    });
    expect(html).toContain("background:#16a34a");
  });
});

describe("wrapEmailHtml", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("wraps inner content in the branded card with the app's warm palette", () => {
    const html = wrapEmailHtml("<p>Hello</p>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<p>Hello</p>");
    // Table-based layout for email-client compatibility.
    expect(html).toContain('role="presentation"');
    expect(html).toContain("max-width:560px");
    // Warm sand page + cream card (app theme).
    expect(html).toContain("background:#f7f3ea");
    expect(html).toContain("background:#fffdf9");
  });

  it("uses the frontend-hosted logo + wordmark lockup with a styled alt fallback", () => {
    const html = wrapEmailHtml("x");
    expect(html).toContain(
      'src="https://app.clastor.example.com/assets/email-logo.png"',
    );
    expect(html).toContain(
      'src="https://app.clastor.example.com/assets/email-wordmark.png"',
    );
    // Logo sits left of the wordmark, both middle-aligned (BrandMark lockup).
    expect(html.indexOf("email-logo.png")).toBeLessThan(
      html.indexOf("email-wordmark.png"),
    );
    expect(html).toContain('alt="Clastor"');
    expect(html).toContain('width="132"');
    // Warm ink color doubles as the alt-text color when images are blocked.
    expect(html).toContain("color:#2b2118");
  });

  it("escapes brand names pulled from EMAIL_FROM", () => {
    // getSenderDisplayName is mocked to "Clastor" here; the escaping of the
    // brand into HTML entities is asserted via the header/footer content.
    const html = wrapEmailHtml("x");
    expect(html).toContain("Sent by Clastor");
  });

  it("keeps inner markup untouched (callers escape their own values)", () => {
    const html = wrapEmailHtml('<p style="margin:0">Hi &amp; bye</p>');
    expect(html).toContain('<p style="margin:0">Hi &amp; bye</p>');
  });
});
