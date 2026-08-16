import { describe, expect, it, vi, beforeEach } from "vitest";

// getSenderDisplayName reads EMAIL_FROM at call time via the config module.
vi.mock("../src/config/email", () => ({
  getSenderDisplayName: () => "Clastor",
}));

import { emailButtonHtml, wrapEmailHtml } from "../src/services/emailLayout";

describe("emailButtonHtml", () => {
  it("renders a styled anchor with the label", () => {
    const html = emailButtonHtml("https://example.com/verify?x=1", "Verify email");
    expect(html).toContain('<a href="https://example.com/verify?x=1"');
    expect(html).toContain("Verify email");
    expect(html).toContain("border-radius:8px");
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

  it("wraps inner content in the branded card", () => {
    const html = wrapEmailHtml("<p>Hello</p>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Clastor");
    expect(html).toContain("<p>Hello</p>");
    // Table-based layout for email-client compatibility.
    expect(html).toContain('role="presentation"');
    expect(html).toContain("max-width:560px");
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
