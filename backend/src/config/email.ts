import nodemailer from "nodemailer";

/**
 * Email configuration
 *
 * SMTP credentials are read from the environment. The transporter is created
 * lazily on first use so the backend can boot even before mail is configured
 * (calls that actually need to send will then throw a clear error).
 */

let transporter: nodemailer.Transporter | null = null;

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

/**
 * Whether outbound email is fully configured (host + user + pass present).
 * Used to give the caller a friendly error instead of an SMTP stack trace.
 */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

/**
 * The sender email address used as the envelope From. This MUST be the
 * authenticated SMTP user (or an address the account is permitted to send
 * as) so the message passes SPF/DMARC and isn't rejected by Gmail etc.
 * Parses a "Name <addr>" style EMAIL_FROM, falling back to SMTP_USER.
 */
export function getSenderAddress(): string {
  const from = process.env.EMAIL_FROM || "";
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return (from || process.env.SMTP_USER || "no-reply@examify-tms.local").trim();
}

/**
 * The organisation/product name parsed from EMAIL_FROM (e.g. "Examify TMS"
 * from "Examify TMS <x@y>"). Used as the "via" suffix on the per-tutor
 * From display name, since the technical sender address can't be the tutor.
 */
export function getSenderDisplayName(): string {
  const from = process.env.EMAIL_FROM || "";
  const match = from.match(/^"?(.*?)"?\s*<.+>$/s);
  if (match && match[1].trim()) return match[1].trim();
  return "Examify TMS";
}

/**
 * The "From" address for outgoing mail, falling back to the SMTP user.
 */
export function getFromAddress(): string {
  return getSenderAddress();
}

/**
 * The notify-student cooldown in milliseconds (default 24h).
 */
export function getNotifyCooldownMs(): number {
  const raw = Number(process.env.NOTIFY_COOLDOWN_MS);
  if (!Number.isFinite(raw) || raw <= 0) return 24 * 60 * 60 * 1000;
  return raw;
}

/**
 * Lazily build and cache the nodemailer SMTP transporter.
 */
export function getEmailTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBool(process.env.SMTP_SECURE, false),
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  return transporter;
}
