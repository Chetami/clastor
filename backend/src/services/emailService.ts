import {
  getEmailTransporter,
  getSenderAddress,
  getSenderDisplayName,
  isEmailConfigured,
} from "../config/email";
import type { Invoice } from "@examify-tms/interfaces";
import { formatInTimeZone } from "date-fns-tz";
import {
  renderEmailTemplate,
  subjectNamePart,
  subjectPart,
} from "./emailTemplateStore";
import { ServiceUnavailableError } from "../utils/AppError";

/**
 * The fully-rendered content of an outbound email, returned by every `send*`
 * and `build*` function so the caller can record it in the sent-email log or
 * return it from a preview endpoint. Mirrors the three nodemailer body fields.
 */
export interface SentEmailContent {
  subject: string;
  text: string;
  html: string;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Lesson notification (reminder / reschedule)
// ---------------------------------------------------------------------------

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

/** Default greeting used when the tutor supplies no custom message. */
export function defaultLessonMessage(
  studentName: string,
  reason?: "reminder" | "reschedule",
): string {
  return renderEmailTemplate(
    reason === "reschedule" ? "reschedule" : "lesson-reminder",
    { studentName },
  ).body;
}

/** Default subject line for a lesson notification (without override). */
export function defaultLessonSubject(
  input: Pick<
    LessonNotificationInput,
    "subject" | "tutorName" | "startDateTime" | "timezone" | "reason"
  >,
): string {
  return renderEmailTemplate(
    input.reason === "reschedule" ? "reschedule" : "lesson-reminder",
    {
      subjectPart: subjectPart(input.subject),
      tutorName: input.tutorName,
      start: formatStart(input.startDateTime, input.timezone),
    },
  ).subject;
}

/**
 * Build the subject line for a lesson reminder / reschedule notice.
 */
export function buildLessonNotificationSubject(input: LessonNotificationInput): string {
  return defaultLessonSubject(input);
}

/**
 * Build the plain-text body. A default greeting is used when no custom
 * message is provided; the lesson details are always appended as a footer.
 */
export function buildLessonNotificationBody(input: LessonNotificationInput): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : defaultLessonMessage(input.studentName, input.reason);

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

/**
 * Build the HTML body. Mirrors the plain-text footer, and — when RSVP links
 * are present — renders Accept/Decline buttons so the student's response
 * flows straight back into the lesson's acceptance status.
 */
export function buildLessonNotificationHtml(input: LessonNotificationInput): string {
  const greeting =
    input.message && input.message.trim().length > 0
      ? escapeHtml(input.message.trim())
      : escapeHtml(defaultLessonMessage(input.studentName, input.reason));

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
 * Render the full lesson-notification email content (subject + text + html)
 * without sending. Used by both {@link sendLessonNotification} and the
 * notify-student preview endpoint so the two never drift apart.
 */
export function buildLessonNotificationContent(
  input: LessonNotificationInput,
): SentEmailContent {
  return {
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
  };
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
    throw new ServiceUnavailableError(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications."
    );
  }

  const content = buildLessonNotificationContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    // Display name reflects the tutor (so the student recognises the sender);
    // the envelope address stays the configured SMTP sender for deliverability.
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
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

  return content;
}

// ---------------------------------------------------------------------------
// Lesson cancellation
// ---------------------------------------------------------------------------

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

/** Default cancellation greeting when no custom message is supplied. */
export function defaultLessonCancellationMessage(studentName: string): string {
  return renderEmailTemplate("cancellation", { studentName }).body;
}

/** Default subject line for a lesson cancellation (without override). */
export function defaultLessonCancellationSubject(
  input: Pick<
    LessonCancellationInput,
    "subject" | "tutorName" | "startDateTime" | "timezone"
  >,
): string {
  return renderEmailTemplate("cancellation", {
    subjectPart: subjectPart(input.subject),
    tutorName: input.tutorName,
    start: formatStart(input.startDateTime, input.timezone),
  }).subject;
}

/**
 * Build the subject line for a lesson cancellation.
 */
export function buildLessonCancellationSubject(
  input: LessonCancellationInput,
): string {
  return defaultLessonCancellationSubject(input);
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
      : defaultLessonCancellationMessage(input.studentName);

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
      : escapeHtml(defaultLessonCancellationMessage(input.studentName));

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

/** Render the full cancellation email content without sending. */
export function buildLessonCancellationContent(
  input: LessonCancellationInput,
): SentEmailContent {
  return {
    subject: buildLessonCancellationSubject(input),
    text: buildLessonCancellationBody(input),
    html: buildLessonCancellationHtml(input),
  };
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
    throw new ServiceUnavailableError(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications."
    );
  }

  const content = buildLessonCancellationContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    ...(input.icsContent
      ? {
          icalEvent: {
            method: "CANCEL" as const,
            content: input.icsContent,
          },
        }
      : {}),
  });

  return content;
}

// ---------------------------------------------------------------------------
// Series-level notification emails (one summary email per change)
// ---------------------------------------------------------------------------

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
  if (intervalWeeks === 4) return "monthly";
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

/** Default greeting for the series-reschedule summary email. */
export function defaultSeriesRescheduleMessage(
  studentName: string,
  subject: string | null,
): string {
  return renderEmailTemplate("series-reschedule", {
    studentName,
    subjectNamePart: subjectNamePart(subject),
  }).body;
}

/** Default subject line for the series-reschedule summary email. */
export function defaultSeriesRescheduleSubject(
  input: Pick<SeriesRescheduleEmailInput, "subject" | "tutorName">,
): string {
  return renderEmailTemplate("series-reschedule", {
    subjectPart: subjectPart(input.subject),
    tutorName: input.tutorName,
  }).subject;
}

/** Render the full series-reschedule summary email content without sending. */
export function buildSeriesRescheduleContent(
  input: SeriesRescheduleEmailInput,
): SentEmailContent {
  const subjectLine = defaultSeriesRescheduleSubject(input);

  const slotSummary = input.slots.map(formatSlot).join(", ");
  const cadence = formatCadence(input.intervalWeeks);
  const firstLine = input.firstUpcoming
    ? `First lesson: ${formatStart(input.firstUpcoming, input.timezone)}`
    : "";

  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : defaultSeriesRescheduleMessage(input.studentName, input.subject);

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

  return { subject: subjectLine, text, html };
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

  const content = buildSeriesRescheduleContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return content;
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

/** Default greeting for the series-cancellation summary email. */
export function defaultSeriesCancellationMessage(
  studentName: string,
  subject: string | null,
  count: number,
): string {
  return renderEmailTemplate("series-cancellation", {
    studentName,
    subjectNamePart: subjectNamePart(subject),
    countPhrase: count === 1 ? "lesson has" : "lessons have",
  }).body;
}

/** Default subject line for the series-cancellation summary email. */
export function defaultSeriesCancellationSubject(
  input: Pick<SeriesCancellationEmailInput, "subject" | "tutorName">,
): string {
  return renderEmailTemplate("series-cancellation", {
    subjectPart: subjectPart(input.subject),
    tutorName: input.tutorName,
  }).subject;
}

/** Render the full series-cancellation summary email content without sending. */
export function buildSeriesCancellationContent(
  input: SeriesCancellationEmailInput,
): SentEmailContent {
  const subjectLine = defaultSeriesCancellationSubject(input);

  const dateList = input.removedDates
    .slice(0, 12) // cap to keep the email readable
    .map((d) => formatStart(d, input.timezone));

  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : defaultSeriesCancellationMessage(
          input.studentName,
          input.subject,
          input.removedDates.length,
        );

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

  return { subject: subjectLine, text, html };
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

  const content = buildSeriesCancellationContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return content;
}

/** A single upcoming occurrence to list in the series summary email. */
export interface SeriesNotificationLesson {
  startDateTime: Date;
  durationMinutes: number;
  location?: string | null;
}

export interface SeriesNotificationEmailInput {
  to: string;
  studentName: string;
  tutorName: string;
  tutorEmail?: string | null;
  subject: string | null;
  timezone?: string | null;
  /** Every upcoming lesson, in chronological order, to list in the email. */
  lessons: SeriesNotificationLesson[];
  message?: string | null;
}

/** Default greeting for the series summary email. */
export function defaultSeriesNotificationMessage(
  studentName: string,
  tutorName: string,
): string {
  return renderEmailTemplate("series-notification", {
    studentName,
    tutorName,
  }).body;
}

/** Default subject line for the series summary email. */
export function defaultSeriesNotificationSubject(
  input: Pick<SeriesNotificationEmailInput, "subject" | "tutorName">,
): string {
  return renderEmailTemplate("series-notification", {
    subjectPart: subjectPart(input.subject),
    tutorName: input.tutorName,
  }).subject;
}

/** Render the full series-summary email content without sending. */
export function buildSeriesNotificationContent(
  input: SeriesNotificationEmailInput,
): SentEmailContent {
  const subjectLine = defaultSeriesNotificationSubject(input);

  const greeting =
    input.message && input.message.trim().length > 0
      ? input.message.trim()
      : defaultSeriesNotificationMessage(input.studentName, input.tutorName);

  const lessonBullets = input.lessons.map((l) => {
    const when = formatStart(l.startDateTime, input.timezone);
    const loc = l.location && l.location.trim().length > 0 ? l.location : null;
    return `• ${when} (${l.durationMinutes} min)${loc ? ` — ${loc}` : ""}`;
  });

  const text =
    `${greeting}\n\n` +
    lessonBullets.join("\n") +
    `\n\nTutor: ${input.tutorName}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0;white-space:pre-line">${escapeHtml(greeting)}</p>` +
    `<ul style="margin:0 0 12px 0;padding-left:20px;line-height:1.8">${input.lessons
      .map((l) => {
        const when = formatStart(l.startDateTime, input.timezone);
        const loc =
          l.location && l.location.trim().length > 0 ? l.location : null;
        return (
          `<li><strong>${escapeHtml(when)}</strong> (${l.durationMinutes} min)` +
          (loc ? `<br><span style="color:#6b7280">${escapeHtml(loc)}</span>` : "") +
          `</li>`
        );
      })
      .join("")}</ul>` +
    `<p style="margin:0 0 12px 0">Tutor: ${escapeHtml(input.tutorName)}</p>` +
    `</div>`;

  return { subject: subjectLine, text, html };
}

/**
 * Send a single summary email notifying the student about ALL upcoming
 * lessons in a series at once, instead of one email per occurrence. Each
 * lesson is rendered as a dated bullet point in the tutor's timezone.
 */
export async function sendSeriesNotificationEmail(
  input: SeriesNotificationEmailInput,
): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send notifications.",
    );
  }

  const content = buildSeriesNotificationContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"${input.tutorName} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return content;
}

// ---------------------------------------------------------------------------
// Invoice email
// ---------------------------------------------------------------------------

export interface InvoiceEmailInput {
  to: string;
  invoice: Invoice;
  tutorName?: string | null;
  tutorEmail?: string | null;
  /** Optional custom body from the tutor; a default is used if absent. */
  message?: string | null;
  /**
   * Optional Stripe-hosted pay link. When present, a "Pay online" button is
   * rendered in the email so the recipient can pay the invoice by card; the
   * payment is processed on the tutor's own Stripe account. Omitted (PDF only)
   * when the tutor hasn't set up Stripe.
   */
  paymentUrl?: string;
  /** Generated PDF attachment bytes. Only required for the actual send. */
  pdfBuffer?: Buffer;
}

function formatCurrency(amount: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Resolve the effective sender display name for an invoice email. */
export function invoiceFromName(input: InvoiceEmailInput): string {
  return input.tutorName || getSenderDisplayName();
}

/** Default subject line for an invoice email (without override). */
export function defaultInvoiceSubject(
  invoice: Invoice,
  fromName: string,
): string {
  return renderEmailTemplate("invoice", {
    invoiceNumber: invoice.invoiceNumber,
    fromName,
  }).subject;
}

/** Default greeting body for an invoice email. */
export function defaultInvoiceMessage(
  customerName: string,
  invoice: Invoice,
  fromName: string,
  paymentUrl?: string,
): string {
  return renderEmailTemplate("invoice", {
    customerName,
    invoiceNumber: invoice.invoiceNumber,
    total: formatCurrency(invoice.total, invoice.currency),
    payLineText: paymentUrl
      ? `You can pay securely online with a card here: ${paymentUrl}\n\n`
      : "",
    fromName,
  }).body;
}

/**
 * Render the full invoice email content (subject + text + html) without
 * sending. The PDF attachment and Stripe pay link are reflected in the body
 * (a "Pay online" button when `paymentUrl` is present) but the PDF bytes are
 * not required here — only the actual send attaches them. Used by both
 * {@link sendInvoiceEmail} and the invoice-send preview endpoint.
 */
export function buildInvoiceEmailContent(input: InvoiceEmailInput): SentEmailContent {
  const { invoice, paymentUrl } = input;
  const fromName = invoiceFromName(input);
  const total = formatCurrency(invoice.total, invoice.currency);

  const subject = defaultInvoiceSubject(invoice, fromName);

  const payLineText = paymentUrl
    ? `You can pay securely online with a card here: ${paymentUrl}\n\n`
    : "";

  const payButtonHtml = paymentUrl
    ? `<div style="margin:4px 0 16px 0">` +
      `<a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Pay ${escapeHtml(total)} online</a>` +
      `<p style="margin:8px 0 0 0;color:#6b7280;font-size:13px">Payment is processed securely by Stripe and goes directly to ${escapeHtml(fromName)}. No account required.</p>` +
      `</div>`
    : "";

  // When the tutor supplies a custom message it replaces the greeting +
  // signature block; the invoice/pay details are always appended so the
  // recipient never loses the amount due or pay button.
  if (input.message && input.message.trim().length > 0) {
    const custom = input.message.trim();
    const text =
      `${custom}\n\n` +
      `Invoice ${invoice.invoiceNumber} attached. Amount due: ${total}.\n` +
      payLineText;

    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
      `<p style="margin:0 0 12px 0;white-space:pre-line">${escapeHtml(custom)}</p>` +
      `<p style="margin:0 0 12px 0">Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached. ` +
      `Amount due: <strong>${escapeHtml(total)}</strong>.</p>` +
      payButtonHtml +
      `</div>`;

    return { subject, text, html };
  }

  const defaultValues = {
    customerName: invoice.customerName,
    invoiceNumber: invoice.invoiceNumber,
    total,
    fromName,
  };

  const text = renderEmailTemplate("invoice", {
    ...defaultValues,
    payLineText,
  }).body;

  // HTML greeting derives from the same template (pay line is "" — the HTML
  // version uses the Pay button). Wrap the invoice number + amount in <strong>
  // for emphasis.
  const renderedHtmlGreeting = escapeHtml(
    renderEmailTemplate("invoice", {
      ...defaultValues,
      payLineText: "",
    }).body,
  )
    .replace(
      escapeHtml(invoice.invoiceNumber),
      `<strong>${escapeHtml(invoice.invoiceNumber)}</strong>`,
    )
    .replace(escapeHtml(total), `<strong>${escapeHtml(total)}</strong>`);

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827;line-height:1.5">` +
    `<p style="margin:0 0 12px 0;white-space:pre-line">${renderedHtmlGreeting}</p>` +
    payButtonHtml +
    `</div>`;

  return { subject, text, html };
}

/**
 * Send an invoice to the parent/billing contact. Attaches the generated PDF
 * and stamps the tutor's display name on the From line so the recipient
 * recognises the sender. Throws if SMTP is unconfigured or the send fails.
 * Returns the rendered content on success so the caller can log it.
 */
export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<SentEmailContent> {
  if (!isEmailConfigured()) {
    throw new ServiceUnavailableError(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send invoices."
    );
  }

  const content = buildInvoiceEmailContent(input);
  const transporter = getEmailTransporter();

  await transporter.sendMail({
    from: `"${invoiceFromName(input)} via ${getSenderDisplayName()}" <${getSenderAddress()}>`,
    replyTo: input.tutorEmail || undefined,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    attachments: [
      {
        filename: `${input.invoice.invoiceNumber}.pdf`,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return content;
}
