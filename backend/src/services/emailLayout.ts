import { getSenderDisplayName } from "../config/email";

/**
 * Branded, email-client-safe HTML shell shared by every outbound email
 * (verification, password reset, lesson notifications, invoices).
 *
 * Constraints that shape this file: email clients strip <style> tags and
 * vary wildly in CSS support, so everything is inline-styled and laid out
 * with tables (the only reliable centering/max-width mechanism). Dark-mode
 * clients may invert colors, hence explicit colors everywhere.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand palette (zinc + the app's dark primary). */
const COLORS = {
  ink: "#18181b",
  inkSoft: "#52525b",
  muted: "#a1a1aa",
  line: "#e4e4e7",
  card: "#ffffff",
  page: "#f4f4f5",
  primary: "#18181b",
  primaryText: "#ffffff",
} as const;

/**
 * Render a rounded, email-safe CTA button link. `color`/`textColor` accept
 * overrides for semantic buttons (e.g. green Accept / red Decline).
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
 * Wrap an email's inner HTML in the branded shell: centered card, brand
 * header bar, padded content area, and footer. The inner markup receives the
 * base typography (Arial 15px) so builders don't repeat it.
 */
export function wrapEmailHtml(inner: string): string {
  const brand = escapeHtml(getSenderDisplayName());
  const year = new Date().getFullYear();

  const header = (
    `<tr>` +
    `<td style="background:${COLORS.ink};padding:20px 32px">` +
    `<span style="color:${COLORS.primaryText};font-family:Arial,Helvetica,sans-serif;` +
    `font-size:16px;font-weight:700;letter-spacing:0.04em">${brand}</span>` +
    `</td>` +
    `</tr>`
  );

  const content = (
    `<tr>` +
    `<td style="padding:32px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:15px;color:${COLORS.ink};line-height:1.6">` +
    inner +
    `</td>` +
    `</tr>`
  );

  const footer = (
    `<tr>` +
    `<td style="padding:18px 32px;border-top:1px solid ${COLORS.line};` +
    `font-family:Arial,Helvetica,sans-serif;font-size:12px;` +
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
    header +
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
