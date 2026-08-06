/**
 * Email template store.
 *
 * The default subject lines and message bodies for every outbound student
 * email are defined here as copy templates with `{{token}}` placeholders,
 * rendered at send time by {@link renderEmailTemplate}. Keeping the copy in
 * one place is the seam for the upcoming per-tutor template editor: swap the
 * hardcoded registry for a stored override (or merge overrides on top of
 * these defaults) without touching the email builders.
 *
 * Structural content — lesson-details footers, bullet lists, calendar invites,
 * the invoice PDF / Stripe pay button — is deliberately NOT part of these
 * templates. Only the copy (subject + message) is editable.
 *
 * Some tokens carry pre-formatted fragments because the renderer is
 * intentionally conditional-free:
 *   - `subjectPart`    — ": <subject>" when the lesson has a subject, else ""
 *   - `subjectNamePart`— " <subject>" when the lesson has a subject, else ""
 *   - `countPhrase`    — "lesson has" / "lessons have" (verb agreement)
 *   - `payLineText`    — the "pay online with a card" sentence + blank line
 *                        (text format), or "" (HTML has the Pay button)
 *   - `start` / `total`— already formatted dates and currency amounts
 */

export type EmailTemplateId =
  | "lesson-reminder"
  | "reschedule"
  | "cancellation"
  | "series-reschedule"
  | "series-cancellation"
  | "series-notification"
  | "invoice";

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplate> = {
  "lesson-reminder": {
    name: "Lesson reminder",
    subject:
      "Lesson reminder{{subjectPart}} with {{tutorName}} on {{start}}",
    body: "Hi {{studentName}},\n\nThis is a reminder about our upcoming lesson.",
  },
  reschedule: {
    name: "Reschedule notice",
    subject:
      "Lesson time updated{{subjectPart}} with {{tutorName}} on {{start}}",
    body: "Hi {{studentName}},\n\nThe time for our upcoming lesson has changed. The updated details are below.",
  },
  cancellation: {
    name: "Cancellation notice",
    subject:
      "Lesson cancelled{{subjectPart}} with {{tutorName}} on {{start}}",
    body: "Hi {{studentName}},\n\nUnfortunately, our upcoming lesson has been cancelled.",
  },
  "series-reschedule": {
    name: "Series schedule update",
    subject: "Schedule updated{{subjectPart}} with {{tutorName}}",
    body: "Hi {{studentName}},\n\nThe schedule for our recurring{{subjectNamePart}} lessons has changed. Here's your new schedule.",
  },
  "series-cancellation": {
    name: "Series cancellation notice",
    subject: "Recurring lessons cancelled{{subjectPart}} with {{tutorName}}",
    body: "Hi {{studentName}},\n\nOur recurring{{subjectNamePart}} lessons have been cancelled. The following upcoming {{countPhrase}} been removed:",
  },
  "series-notification": {
    name: "Upcoming lessons summary",
    subject: "Upcoming lessons{{subjectPart}} with {{tutorName}}",
    body: "Hi {{studentName}},\n\nHere are all your upcoming lessons with {{tutorName}}.",
  },
  invoice: {
    name: "Invoice",
    subject: "Invoice {{invoiceNumber}} from {{fromName}}",
    body: "Hi {{customerName}},\n\nPlease find your invoice {{invoiceNumber}} attached. The amount due is {{total}}.\n\n{{payLineText}}Thank you,\n{{fromName}}",
  },
};

/** True when the given template id is a known email template id. */
export function isEmailTemplateId(id: string): id is EmailTemplateId {
  return id in EMAIL_TEMPLATES;
}

/** Return the default template for an id. Throws for unknown ids. */
export function getEmailTemplate(id: EmailTemplateId): EmailTemplate {
  return EMAIL_TEMPLATES[id];
}

/**
 * Substitute `{{token}}` placeholders in a template string. Unknown tokens are
 * left untouched so a partially-migrated template can never silently drop
 * content.
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** Render the default subject + body for a template id. */
export function renderEmailTemplate(
  id: EmailTemplateId,
  values: Record<string, string>,
): { subject: string; body: string } {
  const template = getEmailTemplate(id);
  return {
    subject: renderTemplate(template.subject, values),
    body: renderTemplate(template.body, values),
  };
}

/** ": <subject>" when the lesson has a subject, else "". */
export function subjectPart(subject: string | null | undefined): string {
  return subject && subject.trim().length > 0 ? `: ${subject.trim()}` : "";
}

/** " <subject>" when the lesson has a subject, else "". */
export function subjectNamePart(subject: string | null | undefined): string {
  return subject && subject.trim().length > 0 ? ` ${subject.trim()}` : "";
}
