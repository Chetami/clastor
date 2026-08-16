import { getFrontendUrl, getSenderDisplayName } from "../config/email";

/**
 * Branded, email-client-safe HTML shell shared by every outbound email
 * (verification, password reset, lesson notifications, invoices).
 *
 * Mirrors the app's theme: warm sand neutrals, a vivid orange primary, and
 * the wordmark rendered in the app's display font (Delius Swash Caps). Email
 * clients don't load webfonts, so the wordmark is a PNG hosted by the
 * frontend (rendered by scripts/render-email-wordmark.swift); when images
 * are blocked the styled alt text keeps the header legible.
 *
 * Constraints that shape this file: email clients strip <style> tags and
 * vary wildly in CSS support, so everything is inline-styled and laid out
 * with tables (the only reliable centering/max-width mechanism). Colors are
 * explicit hex (no oklch — Outlook doesn't understand it) and chosen to
 * survive most dark-mode inversions.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Brand palette — hex equivalents of the app's CSS tokens (index.css):
 * warm sand neutrals + the vivid orange primary (oklch 0.60 0.20 42).
 */
const COLORS = {
  ink: "#2b2118",
  inkSoft: "#6f6353",
  muted: "#8a7d6e",
  line: "#eae3d3",
  card: "#fffdf9",
  page: "#f7f3ea",
  primary: "#e05e0f",
  primarySoft: "#fdeee0",
  primaryText: "#fff9ef",
  accept: "#16a34a",
  decline: "#dc2626",
} as const;

/**
 * Render a rounded, email-safe CTA button link. Defaults to the brand
 * orange; `color`/`textColor` accept overrides for semantic buttons (green
 * Accept / red Decline).
 */
export function emailButtonHtml(
  url: string,
  label: string,
  opts: { color?: string; textColor?: string } = {},
): string {
  const bg = opts.color ?? COLORS.primary;
  const fg = opts.textColor ?? COLORS.primaryText;
  return (
    `<a href="${escapeHtml(url)}" ` +
    `style="display:inline-block;background:${bg};color:${fg};text-decoration:none;` +
    `font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px">` +
    `${escapeHtml(label)}</a>`
  );
}

/**
 * The brand header: logo mark on the left + wordmark in the display font,
 * mirroring the in-app BrandMark lockup. Both are PNGs hosted by the
 * frontend's public assets (rendered by scripts/render-email-wordmark.swift
 * and QuickLook from logo.svg — or replaced by any hand-made 2x PNG).
 * Alt text is styled to approximate the wordmark when images are blocked
 * (common defaults in Gmail/Outlook).
 */
function headerHtml(): string {
  const brand = escapeHtml(getSenderDisplayName());
  const base = getFrontendUrl();
  // Wordmark PNG is 264x112, logo 88x88 — displayed at half for retina.
  return (
    `<tr>` +
    `<td style="background:${COLORS.card};padding:28px 32px 0 32px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
    `<tr>` +
    `<td valign="middle" style="padding-right:12px">` +
    `<img src="${base}/assets/email-logo.png" alt="" width="44" height="44" ` +
    `style="display:block;width:44px;height:44px;border:0">` +
    `</td>` +
    `<td valign="middle">` +
    `<img src="${base}/assets/email-wordmark.png" alt="${brand}" width="132" height="56" ` +
    `style="display:block;width:132px;height:56px;border:0;` +
    `font-family:Georgia,'Times New Roman',serif;font-size:19px;` +
    `font-weight:700;letter-spacing:0.02em;color:${COLORS.ink}">` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</td>` +
    `</tr>`
  );
}

/**
 * Wrap an email's inner HTML in the branded shell: centered cream card on a
 * sand page, wordmark header with notebook-rule accent, padded content area,
 * and a quiet footer. The inner markup receives the base typography so
 * builders don't repeat it.
 */
export function wrapEmailHtml(inner: string): string {
  const brand = escapeHtml(getSenderDisplayName());

  const content = (
    `<tr>` +
    `<td style="padding:28px 32px;font-family:Helvetica,Arial,sans-serif;` +
    `font-size:15px;color:${COLORS.ink};line-height:1.6">` +
    inner +
    `</td>` +
    `</tr>`
  );

  const footer = (
    `<tr>` +
    `<td style="padding:18px 32px;border-top:1px solid ${COLORS.line};` +
    `font-family:Helvetica,Arial,sans-serif;font-size:12px;` +
    `color:${COLORS.muted};line-height:1.5">` +
    `Sent by ${brand}. This is an automated message — replies may not be read.` +
    `</td>` +
    `</tr>`
  );

  return (
    `<!DOCTYPE html>` +
    `<html>` +
    `<body style="margin:0;padding:0;background:${COLORS.page}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="background:${COLORS.page};border-collapse:collapse">` +
    `<tr>` +
    `<td align="center" style="padding:32px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="max-width:560px;background:${COLORS.card};` +
    `border:1px solid ${COLORS.line};border-radius:12px;border-collapse:separate;overflow:hidden">` +
    headerHtml() +
    content +
    footer +
    `</table>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</body>` +
    `</html>`
  );
}
