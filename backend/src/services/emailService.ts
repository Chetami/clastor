import {
  getEmailTransporter,
  getSenderAddress,
  getSenderDisplayName,
  isEmailConfigured,
} from "../config/email";
import type { Invoice } from "@examify-tms/interfaces";
import { formatInTimeZone } from "date-fns-tz";

/**
 * The fully-rendered content of an outbound email, returned by every `send*`
 * function so the caller can record it in the sent-email log. Mirrors the
 * three nodemailer body fields.
 */
export interface SentEmailContent {
  subject: string;
  text: string;
  html: string;
}

/** Context required to render and send a lesson notification email. */
export interface LessonNotificationInput {
  to: string;
  studentName: string;
  tutorName: string;
  /** Tutor's real email — used as Reply-To so replies reach the tutor. */
  tutorEmail?: string | null;
  subject: string | null;
  startDateTime: Date;
  durationMinutes: number;
  location?: string | null;
  /**
   * IANA timezone identifier the tutor is in (e.g. Australia/Sydney). Times
   * in the subject line and body are rendered in this zone so the student
   * sees the tutor's local time. Null/undefined falls back to UTC.
   */
  timezone?: string | null;
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
  /**
   * Why this notification is being sent. Selects the subject-line prefix and
   * (when no explicit message is supplied) the default greeting — a reschedule
   * reads differently from a plain reminder. Defaults to a reminder.
   */
  reason?: "reminder" | "reschedule";
}

/**
 * Resolve the timezone to render times in. Falls back to UTC (matching the
 * server's default) when none is configured, so legacy tutors without a
 * stored timezone still get a deterministic, unambiguous time.
 */
function resolveTz(tz?: string | null): string {
  return tz && tz.trim() ? tz.trim() : "Etc/UTC";
}

/**
 * Format a full start date/time, e.g. "Monday, July 13, 2026, 8:00 PM",
 * in the given timezone.
 */
function formatStart(d: Date, tz?: string | null): string {
  return formatInTimeZone(d, resolveTz(tz), "EEEE, MMMM d, yyyy, h:mm a");
}

/**
 * Format a short time-of-day, e.g. "8:00 PM", in the given timezone.
 */
function formatTime(d: Date, tz?: string | null): string {
  return formatInTimeZone(d, resolveTz(tz), "h:mm a");
}

/**
 * Build the subject line for a lesson reminder / reschedule notice.
 */
export function buildLessonNotificationSubject(input: LessonNotificationInput): string {
  const prefix =
    input.reason === "reschedule" ? "Lesson time updated" : "Lesson reminder";
  return `${prefix}${input.subject ? `: ${input.subject}` : ""} with ${input.tutorName} on ${formatStart(input.startDateTime, input.timezone)}`;
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
  const timeRange = `${formatTime(input.startDateTime, input.timezone)} – ${formatTime(end, input.timezone)}`;

  const footerLines = [
    "",
    "—",
    "Lesson details",
    ...(input.subject ? [`Subject: ${input.subject}`] : []),
    `When: ${formatStart(input.startDateTime, input.timezone)} (${timeRange}, ${input.durationMinutes} min)`,
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
  const timeRange = `${formatTime(input.startDateTime, input.timezone)} – ${formatTime(end, input.timezone)}`;

  const rows = [
    ...(input.subject ? [["Subject", escapeHtml(input.subject)]] : []),
    [
      "When",
      `${escapeHtml(formatStart(input.startDateTime, input.timezone))} (${escapeHtml(
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
 * Returns the rendered content on success so the caller can log it.
 */
export async function sendLessonNotification(
  input: LessonNotificationInput
): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications."
    );
  }

  const subject = buildLessonNotificationSubject(input);
  const text = buildLessonNotificationBody(input);
  const html = buildLessonNotificationHtml(input);

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    // Display name reflects the tutor (so the student recognises the sender);
    // the envelope address stays the configured SMTP sender for deliverability.
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject,
    text,
    html,
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

  return { subject, text, html };
}

/** Context required to render and send a lesson cancellation email. */
export interface LessonCancellationInput {
  to: string;
  studentName: string;
  tutorName: string;
  /** Tutor's real email — used as Reply-To so replies reach the tutor. */
  tutorEmail?: string | null;
  subject: string | null;
  startDateTime: Date;
  durationMinutes: number;
  location?: string | null;
  /**
   * IANA timezone identifier the tutor is in (e.g. Australia/Sydney). Times
   * in the subject line and body are rendered in this zone. Null/undefined
   * falls back to UTC.
   */
  timezone?: string | null;
  /** Optional custom body from the tutor; a default is used if absent. */
  message?: string | null;
  /**
   * Optional METHOD:CANCEL iCalendar invite. When attached, the student's
   * calendar client removes the previously-added event. Omitted when the
   * student was never sent an invite.
   */
  icsContent?: string;
}

/**
 * Build the subject line for a lesson cancellation.
 */
export function buildLessonCancellationSubject(
  input: LessonCancellationInput,
): string {
  return `Lesson cancelled${
    input.subject ? `: ${input.subject}` : ""
  } with ${input.tutorName} on ${formatStart(input.startDateTime, input.timezone)}`;
}

/**
 * Build the plain-text cancellation body.
 */
export function buildLessonCancellationBody(
  input: LessonCancellationInput,
): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : `Hi ${input.studentName},\n\nUnfortunately, our upcoming lesson has been cancelled.`;

  const footerLines = [
    "",
    "—",
    "Cancelled lesson",
    ...(input.subject ? [`Subject: ${input.subject}`] : []),
    `When: ${formatStart(input.startDateTime, input.timezone)}`,
    `Tutor: ${input.tutorName}`,
  ].filter(Boolean);

  return `${greeting}\n${footerLines.join("\n")}`;
}

/**
 * Build the HTML cancellation body, mirroring the plain-text footer. No RSVP
 * buttons — the lesson is cancelled.
 */
export function buildLessonCancellationHtml(
  input: LessonCancellationInput,
): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? escapeHtml(input.message.trim())
      : `Hi ${escapeHtml(
          input.studentName,
        )},<br><br>Unfortunately, our upcoming lesson has been cancelled.`;

  const rows = [
    ...(input.subject ? [["Subject", escapeHtml(input.subject)]] : []),
    ["When", escapeHtml(formatStart(input.startDateTime, input.timezone))],
    ["Tutor", escapeHtml(input.tutorName)],
  ];

  const details = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:2px 0">${value}</td></tr>`,
    )
    .join("");

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 16px 0;white-space:pre-line">${greeting}</p>` +
    (input.icsContent
      ? `<p style="margin:0 0 8px 0;color:#6b7280;font-size:13px">A calendar update is attached — the event will be removed from your calendar.</p>`
      : "") +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">` +
    `<table style="border-collapse:collapse;font-size:14px">${details}</table>` +
    `</div>`
  );
}

/**
 * Send a lesson cancellation email. Throws if SMTP is not configured or if the
 * transporter rejects the send, so the caller can surface the failure. Returns
 * the rendered content on success so the caller can log it.
 */
export async function sendLessonCancellation(
  input: LessonCancellationInput,
): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications."
    );
  }

  const subject = buildLessonCancellationSubject(input);
  const text = buildLessonCancellationBody(input);
  const html = buildLessonCancellationHtml(input);

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject,
    text,
    html,
    ...(input.icsContent
      ? {
          icalEvent: {
            method: "CANCEL" as const,
            content: input.icsContent,
          },
        }
      : {}),
  });

  return { subject, text, html };
}

// ---- Series-level notification emails (one summary email per change) --------

/** Format a weekly slot as a readable day+time, e.g. "Mondays at 4:00 PM". */
function formatSlot(slot: { dayOfWeek: string; timeOfDay: string }): string {
  const day = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1) + "s";
  const [h, m] = slot.timeOfDay.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${day} at ${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Human cadence label from the interval in weeks. */
function formatCadence(intervalWeeks: number): string {
  if (intervalWeeks === 1) return "weekly";
  if (intervalWeeks === 2) return "fortnightly";
  return `every ${intervalWeeks} weeks`;
}

export interface SeriesRescheduleEmailInput {
  to: string;
  studentName: string;
  tutorName: string;
  tutorEmail?: string | null;
  subject: string | null;
  timezone?: string | null;
  slots: { dayOfWeek: string; timeOfDay: string }[];
  intervalWeeks: number;
  firstUpcoming?: Date | null;
  message?: string | null;
}

/**
 * Send a single summary email notifying the student that their recurring
 * lesson schedule has changed. Renders the new slots + cadence and the first
 * upcoming date, all in the tutor's timezone. No ICS attachment — it's a
 * schedule summary, not a single event.
 */
export async function sendSeriesRescheduleEmail(
  input: SeriesRescheduleEmailInput,
): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications.",
    );
  }

  const subjectLine = `Schedule updated${
    input.subject ? `: ${input.subject}` : ""
  } with ${input.tutorName}`;

  const slotSummary = input.slots.map(formatSlot).join(", ");
  const cadence = formatCadence(input.intervalWeeks);
  const firstLine = input.firstUpcoming
    ? `First lesson: ${formatStart(input.firstUpcoming, input.timezone)}`
    : "";

  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : `Hi ${input.studentName},\n\nThe schedule for our recurring${input.subject ? ` ${input.subject}` : ""} lessons has changed. Here's your new schedule.`;

  const text =
    `${greeting}\n\n` +
    `New schedule: ${slotSummary} (${cadence})\n` +
    (firstLine ? `${firstLine}\n` : "") +
    `\nTutor: ${input.tutorName}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0;white-space:pre-line">${escapeHtml(greeting)}</p>` +
    `<p style="margin:0 0 8px 0"><strong>${escapeHtml(slotSummary)}</strong> ` +
    `<span style="color:#6b7280">(${escapeHtml(cadence)})</span></p>` +
    (firstLine ? `<p style="margin:0 0 12px 0">${escapeHtml(firstLine)}</p>` : "") +
    `<p style="margin:0 0 12px 0">Tutor: ${escapeHtml(input.tutorName)}</p>` +
    `</div>`;

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: subjectLine,
    text,
    html,
  });

  return { subject: subjectLine, text, html };
}

export interface SeriesCancellationEmailInput {
  to: string;
  studentName: string;
  tutorName: string;
  tutorEmail?: string | null;
  subject: string | null;
  timezone?: string | null;
  removedDates: Date[];
  message?: string | null;
}

/**
 * Send a single summary email notifying the student that their recurring
 * lessons have been cancelled. Lists the removed upcoming dates in the
 * tutor's timezone.
 */
export async function sendSeriesCancellationEmail(
  input: SeriesCancellationEmailInput,
): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications.",
    );
  }

  const subjectLine = `Recurring lessons cancelled${
    input.subject ? `: ${input.subject}` : ""
  } with ${input.tutorName}`;

  const dateList = input.removedDates
    .slice(0, 12) // cap to keep the email readable
    .map((d) => formatStart(d, input.timezone));

  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : `Hi ${input.studentName},\n\nOur recurring${input.subject ? ` ${input.subject}` : ""} lessons have been cancelled. The following upcoming ${input.removedDates.length === 1 ? "lesson has" : `lessons have`} been removed:`;

  const text =
    `${greeting}\n\n` +
    dateList.map((d) => `• ${d}`).join("\n") +
    (input.removedDates.length > dateList.length
      ? `\n…and ${input.removedDates.length - dateList.length} more`
      : "") +
    `\n\nTutor: ${input.tutorName}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0;white-space:pre-line">${escapeHtml(greeting)}</p>` +
    `<ul style="margin:0 0 12px 0;padding-left:20px;line-height:1.8">${dateList
      .map((d) => `<li>${escapeHtml(d)}</li>`)
      .join("")}</ul>` +
    (input.removedDates.length > dateList.length
      ? `<p style="margin:0 0 12px 0;color:#6b7280">…and ${input.removedDates.length - dateList.length} more</p>`
      : "") +
    `<p style="margin:0 0 12px 0">Tutor: ${escapeHtml(input.tutorName)}</p>` +
    `</div>`;

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: subjectLine,
    text,
    html,
  });

  return { subject: subjectLine, text, html };
}

export interface InvoiceEmailInput {
  to: string;
  invoice: Invoice;
  tutorName?: string | null;
  tutorEmail?: string | null;
  /** Generated PDF attachment bytes. */
  pdfBuffer: Buffer;
  /**
   * Optional Stripe-hosted pay link. When present, a "Pay online" button is
   * rendered in the email so the recipient can pay the invoice by card; the
   * payment is processed on the tutor's own Stripe account. Omitted (PDF only)
   * when the tutor hasn't set up Stripe.
   */
  paymentUrl?: string;
}

function formatCurrency(amount: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Send an invoice to the parent/billing contact. Attaches the generated PDF
 * and stamps the tutor's display name on the From line so the recipient
 * recognises the sender. Throws if SMTP is unconfigured or the send fails.
 * Returns the rendered content on success so the caller can log it.
 */
export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send invoices."
    );
  }

  const { invoice, tutorName, paymentUrl } = input;
  const fromName = tutorName || getSenderDisplayName();
  const subject = `Invoice ${invoice.invoiceNumber} from ${fromName}`;
  const total = formatCurrency(invoice.total, invoice.currency);

  const payLineText = paymentUrl
    ? `You can pay securely online with a card here: ${paymentUrl}\n\n`
    : "";

  const payButtonHtml = paymentUrl
    ? `<div style="margin:4px 0 16px 0">` +
      `<a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Pay ${escapeHtml(total)} online</a>` +
      `<p style="margin:8px 0 0 0;color:#6b7280;font-size:13px">Payment is processed securely by Stripe and goes directly to ${escapeHtml(fromName)}. No account required.</p>` +
      `</div>`
    : "";

  const text =
    `Hi ${invoice.customerName},\n\n` +
    `Please find your invoice ${invoice.invoiceNumber} attached. ` +
    `The amount due is ${total}.\n\n` +
    payLineText +
    `Thank you,\n${fromName}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0">Hi ${escapeHtml(invoice.customerName)},</p>` +
    `<p style="margin:0 0 12px 0">Please find your invoice ` +
    `<strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached. ` +
    `The amount due is <strong>${escapeHtml(total)}</strong>.</p>` +
    payButtonHtml +
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

  return { subject, text, html };
}

