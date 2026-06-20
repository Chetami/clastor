import {
  getEmailTransporter,
  getSenderAddress,
  getSenderDisplayName,
  isEmailConfigured,
} from "../config/email";

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
  });
}
