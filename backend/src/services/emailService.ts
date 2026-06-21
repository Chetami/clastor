import {
  getEmailTransporter,
  getSenderAddress,
  getSenderDisplayName,
  isEmailConfigured,
} from "../config/email";
import type { Invoice } from "@examify-tms/interfaces";

/** Context required to render and send a lesson notification email. */
export interface LessonNotificationInput {
  to: string;
  studentName: string;
  tutorName: string;
  /** Tutor's real email — used as Reply-To so replies reach the tutor. */
  tutorEmail?: string | null;
  subject: string;
  startDateTime: Date;
  durationMinutes: number;
  location?: string | null;
  /** Optional custom body from the tutor; a default greeting is used if absent. */
  message?: string | null;
  /**
   * iCalendar invite (METHOD:REQUEST) to attach so the email doubles as a
   * calendar meeting request. When omitted, the email is plain-text only
   * (legacy behaviour).
   */
  icsContent?: string;
  /**
   * One-click RSVP links rendered as Accept/Decline buttons in the HTML
   * body. Only meaningful when an invite is attached. Both are optional so
   * the invite can be sent without response buttons if ever needed.
   */
  rsvpLinks?: { accept: string; decline: string };
}

function formatStart(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Build the subject line for a lesson reminder.
 */
export function buildLessonNotificationSubject(input: LessonNotificationInput): string {
  return `Lesson reminder: ${input.subject} with ${input.tutorName} on ${formatStart(input.startDateTime)}`;
}

/**
 * Build the plain-text body. A default greeting is used when no custom
 * message is provided; the lesson details are always appended as a footer.
 */
export function buildLessonNotificationBody(input: LessonNotificationInput): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : `Hi ${input.studentName},\n\nThis is a reminder about our upcoming lesson.`;

  const end = new Date(input.startDateTime.getTime() + input.durationMinutes * 60_000);
  const timeRange = `${input.startDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  const footerLines = [
    "",
    "—",
    "Lesson details",
    `Subject: ${input.subject}`,
    `When: ${formatStart(input.startDateTime)} (${timeRange}, ${input.durationMinutes} min)`,
    input.location ? `Location: ${input.location}` : null,
    `Tutor: ${input.tutorName}`,
  ].filter(Boolean);

  return `${greeting}\n${footerLines.join("\n")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the HTML body. Mirrors the plain-text footer, and — when RSVP links
 * are present — renders Accept/Decline buttons so the student's response
 * flows straight back into the lesson's acceptance status.
 */
export function buildLessonNotificationHtml(input: LessonNotificationInput): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? escapeHtml(input.message.trim())
      : `Hi ${escapeHtml(input.studentName)},<br><br>This is a reminder about our upcoming lesson.`;

  const end = new Date(input.startDateTime.getTime() + input.durationMinutes * 60_000);
  const timeRange = `${input.startDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  const rows = [
    ["Subject", escapeHtml(input.subject)],
    [
      "When",
      `${escapeHtml(formatStart(input.startDateTime))} (${escapeHtml(
        timeRange
      )}, ${input.durationMinutes} min)`,
    ],
    ...(input.location ? [["Location", escapeHtml(input.location)]] : []),
    ["Tutor", escapeHtml(input.tutorName)],
  ];

  const details = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:2px 0">${value}</td></tr>`
    )
    .join("");

  const rsvp = input.rsvpLinks
    ? `<div style="margin-top:24px;font-size:15px">Will you be there?</div>` +
      `<div style="margin-top:10px">` +
      `<a href="${escapeHtml(
        input.rsvpLinks.accept
      )}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;margin-right:8px;font-weight:600">Accept</a>` +
      `<a href="${escapeHtml(
        input.rsvpLinks.decline
      )}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Decline</a>` +
      `</div>`
    : "";

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 16px 0;white-space:pre-line">${greeting}</p>` +
    (input.icsContent
      ? `<p style="margin:0 0 8px 0;color:#6b7280;font-size:13px">A calendar invite is attached — add it to your calendar to confirm the time.</p>`
      : "") +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">` +
    `<table style="border-collapse:collapse;font-size:14px">${details}</table>` +
    rsvp +
    `</div>`
  );
}

/**
 * Send a lesson notification email. Throws if SMTP is not configured or if
 * the transporter rejects the send, so the caller can surface the failure.
 */
export async function sendLessonNotification(
  input: LessonNotificationInput
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications."
    );
  }

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    // Display name reflects the tutor (so the student recognises the sender);
    // the envelope address stays the configured SMTP sender for deliverability.
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
    ...(input.icsContent
      ? {
          // nodemailer renders this as a proper text/calendar; method=REQUEST
          // alternative so email clients treat the message as a meeting invite.
          icalEvent: {
            method: "REQUEST" as const,
            content: input.icsContent,
          },
        }
      : {}),
  });
}

export interface InvoiceEmailInput {
  to: string;
  invoice: Invoice;
  tutorName?: string | null;
  tutorEmail?: string | null;
  /** Generated PDF attachment bytes. */
  pdfBuffer: Buffer;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Send an invoice to the parent/billing contact. Attaches the generated PDF
 * and stamps the tutor's display name on the From line so the recipient
 * recognises the sender. Throws if SMTP is unconfigured or the send fails.
 */
export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send invoices."
    );
  }

  const { invoice, tutorName } = input;
  const fromName = tutorName || getSenderDisplayName();
  const subject = `Invoice ${invoice.invoiceNumber} from ${fromName}`;
  const total = formatCurrency(invoice.total);

  const text =
    `Hi ${invoice.customerName},\n\n` +
    `Please find your invoice ${invoice.invoiceNumber} attached. ` +
    `The amount due is ${total}.\n\n` +
    `Thank you,\n${fromName}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0">Hi ${escapeHtml(invoice.customerName)},</p>` +
    `<p style="margin:0 0 12px 0">Please find your invoice ` +
    `<strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached. ` +
    `The amount due is <strong>${escapeHtml(total)}</strong>.</p>` +
    `<p style="margin:0 0 12px 0">Thank you,<br>${escapeHtml(fromName)}</p>` +
    `</div>`;

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${fromName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

