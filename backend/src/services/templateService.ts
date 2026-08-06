import {
  Invoice,
  InvoiceLineItem,
  TemplateSummary,
  EmailTemplatePreview,
} from "@examify-tms/interfaces";
import { generateInvoicePdf } from "./invoicePdfService";
import { getUserFromFirestore } from "./userService";
import {
  buildLessonNotificationSubject,
  buildLessonNotificationBody,
  buildLessonNotificationHtml,
  buildLessonCancellationSubject,
  buildLessonCancellationBody,
  buildLessonCancellationHtml,
  buildSeriesRescheduleContent,
  buildSeriesCancellationContent,
  buildSeriesNotificationContent,
  buildInvoiceEmailContent,
  type LessonNotificationInput,
  type LessonCancellationInput,
  type SeriesRescheduleEmailInput,
  type SeriesCancellationEmailInput,
  type SeriesNotificationEmailInput,
  type SeriesNotificationLesson,
  type InvoiceEmailInput,
} from "./emailService";
import { buildLessonInvite, buildLessonCancellation } from "./icalService";

/**
 * Read-only template previews.
 *
 * Each preview renders the *real* generator (invoice PDF, lesson notification
 * email, iCal invite) against fixed sample data, so what the tutor sees in the
 * gallery always matches what actually gets sent. The sample data lives here
 * only — no DB records are touched. This is the natural seam for future
 * customisability: swap the hardcoded builders for a templating engine without
 * changing the preview API surface.
 */

export const TEMPLATE_LIST: TemplateSummary[] = [
  {
    id: "lesson-reminder",
    name: "Lesson reminder",
    type: "email",
    group: "Lessons",
    description:
      "Reminder emailed to a student before a lesson, with the lesson details.",
  },
  {
    id: "meet-invite",
    name: "Google Meet invite",
    type: "email",
    group: "Lessons",
    description:
      "Lesson reminder that also carries a calendar invite with a Google Meet link and RSVP buttons.",
  },
  {
    id: "reschedule",
    name: "Reschedule notice",
    type: "email",
    group: "Lessons",
    description:
      "Sent automatically when you reschedule a lesson with “notify student” on — an updated invite with the new time.",
  },
  {
    id: "cancellation",
    name: "Cancellation notice",
    type: "email",
    group: "Lessons",
    description:
      "Sent when you cancel a lesson and choose to notify the student — removes the event from their calendar.",
  },
  {
    id: "series-notification",
    name: "Upcoming lessons summary",
    type: "email",
    group: "Recurring series",
    description:
      "Summary email listing all upcoming lessons in a recurring series at once.",
  },
  {
    id: "series-reschedule",
    name: "Series schedule update",
    type: "email",
    group: "Recurring series",
    description:
      "Sent when a recurring lesson schedule changes — shows the new time slots and cadence.",
  },
  {
    id: "series-cancellation",
    name: "Series cancellation",
    type: "email",
    group: "Recurring series",
    description:
      "Sent when recurring lessons are cancelled — lists every upcoming date removed.",
  },
  {
    id: "invoice",
    name: "Invoice",
    type: "pdf",
    group: "Invoices",
    description:
      "PDF attached to the invoice email sent to a parent or billing contact.",
  },
  {
    id: "invoice-email",
    name: "Invoice email",
    type: "email",
    group: "Invoices",
    description:
      "The email message that accompanies an invoice, with the amount due and a pay-online button.",
  },
];

// ---- Fixed sample data -----------------------------------------------------

const SAMPLE_TUTOR = {
  name: "Jordan Lee",
  email: "jordan.lee@example.com",
};

const SAMPLE_STUDENT = {
  name: "Alex Carter",
  email: "alex.carter@example.com",
  parentEmail: "parent.carter@example.com",
};

const SAMPLE_SUBJECT = "Mathematics";
const SAMPLE_MEET_LINK = "https://meet.google.com/abc-mnop-xyz";

/**
 * The next occurrence of weekday `targetDay` (0=Sun) at `hour`:`min`, from
 * now. Keeps the preview date fresh (never obviously stale) while remaining
 * deterministic for any given run.
 */
function nextWeekdayAt(targetDay: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function sampleInvoice(): Invoice {
  const now = new Date();
  const issueDate = new Date(now);
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const lineItems: InvoiceLineItem[] = [
    {
      lessonId: "lesson_sample_1",
      description: `${SAMPLE_SUBJECT} — 60 min on ${now.toLocaleDateString(
        "en-AU",
        { day: "numeric", month: "short", year: "numeric" },
      )}`,
      durationMinutes: 60,
      rateType: "hourly",
      unitAmount: 45,
      quantity: 1,
      amount: 45,
    },
    {
      lessonId: "lesson_sample_2",
      description: `${SAMPLE_SUBJECT} — 90 min on ${new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
      durationMinutes: 90,
      rateType: "hourly",
      unitAmount: 45,
      quantity: 1.5,
      amount: 67.5,
    },
  ];

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

  return {
    id: "inv_sample",
    invoiceNumber: "INV-0001",
    tutorId: "tutor_sample",
    studentId: "student_sample",
    customerName: SAMPLE_STUDENT.parentEmail
      ? "Carter Family"
      : SAMPLE_STUDENT.name,
    billingEmail: SAMPLE_STUDENT.parentEmail,
    status: "open",
    currency: "AUD",
    lineItems,
    subtotal,
    total: subtotal,
    paymentMethod: "bank_transfer",
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    notes: "Thank you for your prompt payment. Please reference the invoice number in your transfer.",
    createdAt: issueDate.toISOString(),
    updatedAt: issueDate.toISOString(),
  };
}

interface SampleLessonOptions {
  /** Include a Google Meet link, calendar invite, and RSVP buttons. */
  withMeet: boolean;
  /** Tutor's IANA timezone, so sample times render in local time. */
  timezone?: string | null;
}

function sampleLessonInput({
  withMeet,
  timezone,
}: SampleLessonOptions): { input: LessonNotificationInput; ics?: string } {
  const start = nextWeekdayAt(1, 16, 0); // next Monday, 4:00 PM
  const durationMinutes = 60;

  const location = withMeet ? SAMPLE_MEET_LINK : "Online";

  const ics = withMeet
    ? buildLessonInvite({
        icsUid: "lesson-sample-uid@clastor",
        sequence: 0,
        summary: `${SAMPLE_SUBJECT} with ${SAMPLE_TUTOR.name}`,
        start,
        end: new Date(start.getTime() + durationMinutes * 60_000),
        timezone: timezone ?? null,
        location,
        description: `Online lesson via Google Meet.`,
        organizer: { name: SAMPLE_TUTOR.name, email: SAMPLE_TUTOR.email },
        attendee: { name: SAMPLE_STUDENT.name, email: SAMPLE_STUDENT.email },
      })
    : undefined;

  const input: LessonNotificationInput = {
    to: SAMPLE_STUDENT.email,
    studentName: SAMPLE_STUDENT.name,
    tutorName: SAMPLE_TUTOR.name,
    tutorEmail: SAMPLE_TUTOR.email,
    subject: SAMPLE_SUBJECT,
    startDateTime: start,
    durationMinutes,
    timezone: timezone ?? null,
    location,
    message: `Hi ${SAMPLE_STUDENT.name},\n\nLooking forward to our ${SAMPLE_SUBJECT} lesson. ${
      withMeet ? "Join the meeting using the link below." : ""
    }`,
    icsContent: ics,
    rsvpLinks: withMeet
      ? {
          accept:
            "https://clastor.app/rsvp?token=sample&status=accepted",
          decline:
            "https://clastor.app/rsvp?token=sample&status=declined",
        }
      : undefined,
  };

  return { input, ics };
}

// ---- Public preview API ----------------------------------------------------

/**
 * Best-effort load of the requesting tutor's timezone so sample preview times
 * render in their local time. Falls back to null (UTC) if the user can't be
 * loaded, mirroring previewInvoicePdf's resilience.
 */
async function loadTutorTimezone(
  tutorUid?: string,
): Promise<string | null> {
  if (!tutorUid) return null;
  try {
    const tutor = await getUserFromFirestore(tutorUid);
    return tutor.timezone ?? null;
  } catch (error) {
    console.error("loadTutorTimezone: failed to load tutor, using UTC:", error);
    return null;
  }
}

export function listTemplates(): TemplateSummary[] {
  return TEMPLATE_LIST;
}

/**
 * Render the invoice template against sample data, but personalised with the
 * requesting tutor's own details (name, email, ABN, bank details) so the
 * preview matches what they will actually send. Falls back to the sample
 * tutor identity if the user document can't be loaded.
 */
export async function previewInvoicePdf(
  tutorUid?: string,
): Promise<Buffer> {
  let tutorName = SAMPLE_TUTOR.name;
  let tutorEmail = SAMPLE_TUTOR.email;
  let abn: string | null = null;
  let bankDetails = null;

  if (tutorUid) {
    try {
      const tutor = await getUserFromFirestore(tutorUid);
      tutorName = tutor.name;
      tutorEmail = tutor.email;
      abn = tutor.invoiceSettings?.abn ?? null;
      bankDetails = tutor.invoiceSettings?.bankDetails ?? null;
    } catch (error) {
      console.error("previewInvoicePdf: failed to load tutor, using fallback:", error);
    }
  }

  return generateInvoicePdf(sampleInvoice(), {
    tutorName,
    tutorEmail,
    abn,
    bankDetails,
  });
}

export async function previewLessonReminder(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const { input } = sampleLessonInput({ withMeet: false, timezone });
  return {
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
    ics: null,
  };
}

export async function previewMeetInvite(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const { input, ics } = sampleLessonInput({ withMeet: true, timezone });
  return {
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
    ics: ics ?? null,
  };
}

export async function previewReschedule(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const { input, ics } = sampleLessonInput({ withMeet: true, timezone });
  // Mirrors dispatchLessonNotification({ reason: "reschedule" }): the subject
  // becomes "Lesson time updated" and a null message lets the template store
  // supply the reschedule-appropriate default greeting.
  const rescheduleInput: LessonNotificationInput = {
    ...input,
    reason: "reschedule",
    message: null,
  };
  return {
    subject: buildLessonNotificationSubject(rescheduleInput),
    text: buildLessonNotificationBody(rescheduleInput),
    html: buildLessonNotificationHtml(rescheduleInput),
    ics: ics ?? null,
  };
}

export async function previewCancellation(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const { input } = sampleLessonInput({ withMeet: false, timezone });
  const start = input.startDateTime;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  // A CANCEL iCal is attached when the student was previously invited, so the
  // preview reflects the real cancellation email (event removed from calendar).
  const icsContent = buildLessonCancellation({
    icsUid: "lesson-sample-uid@clastor",
    sequence: 1,
    summary: `${input.subject ?? "Lesson"} with ${input.tutorName}`,
    start,
    end,
    timezone: timezone ?? null,
    location: input.location,
    organizer: { name: input.tutorName, email: input.tutorEmail },
    attendee: { name: input.studentName, email: input.to },
  });
  const cancelInput: LessonCancellationInput = {
    to: input.to,
    studentName: input.studentName,
    tutorName: input.tutorName,
    tutorEmail: input.tutorEmail,
    subject: input.subject,
    startDateTime: start,
    durationMinutes: input.durationMinutes,
    timezone: timezone ?? null,
    location: input.location,
    message: null,
    icsContent,
  };
  return {
    subject: buildLessonCancellationSubject(cancelInput),
    text: buildLessonCancellationBody(cancelInput),
    html: buildLessonCancellationHtml(cancelInput),
    ics: icsContent,
  };
}

// ---- Series-level email previews ------------------------------------------

/** Sample recurring-slot used by the series previews. */
const SAMPLE_SLOTS = [{ dayOfWeek: "monday", timeOfDay: "16:00" }];

/**
 * Build a handful of upcoming occurrences from the sample weekly slot so the
 * series-summary preview has realistic, fresh dates in the tutor's timezone.
 */
function sampleUpcomingLessons(
  count: number,
  intervalWeeks: number,
  timezone: string | null,
): SeriesNotificationLesson[] {
  const start = nextWeekdayAt(1, 16, 0); // next Monday 4 PM
  const lessons: SeriesNotificationLesson[] = [];
  for (let i = 0; i < count; i++) {
    lessons.push({
      startDateTime: new Date(start.getTime() + i * intervalWeeks * 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      location: SAMPLE_MEET_LINK,
    });
  }
  return lessons;
}

export async function previewSeriesNotification(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const lessons = sampleUpcomingLessons(4, 1, timezone);
  const input: SeriesNotificationEmailInput = {
    to: SAMPLE_STUDENT.email,
    studentName: SAMPLE_STUDENT.name,
    tutorName: SAMPLE_TUTOR.name,
    tutorEmail: SAMPLE_TUTOR.email,
    subject: SAMPLE_SUBJECT,
    timezone: timezone ?? null,
    lessons,
  };
  const content = buildSeriesNotificationContent(input);
  return { ...content, ics: null };
}

export async function previewSeriesReschedule(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const input: SeriesRescheduleEmailInput = {
    to: SAMPLE_STUDENT.email,
    studentName: SAMPLE_STUDENT.name,
    tutorName: SAMPLE_TUTOR.name,
    tutorEmail: SAMPLE_TUTOR.email,
    subject: SAMPLE_SUBJECT,
    timezone: timezone ?? null,
    slots: SAMPLE_SLOTS,
    intervalWeeks: 1,
    firstUpcoming: nextWeekdayAt(1, 16, 0),
  };
  const content = buildSeriesRescheduleContent(input);
  return { ...content, ics: null };
}

export async function previewSeriesCancellation(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  const timezone = await loadTutorTimezone(tutorUid);
  const input: SeriesCancellationEmailInput = {
    to: SAMPLE_STUDENT.email,
    studentName: SAMPLE_STUDENT.name,
    tutorName: SAMPLE_TUTOR.name,
    tutorEmail: SAMPLE_TUTOR.email,
    subject: SAMPLE_SUBJECT,
    timezone: timezone ?? null,
    removedDates: sampleUpcomingLessons(4, 1, timezone).map((l) => l.startDateTime),
  };
  const content = buildSeriesCancellationContent(input);
  return { ...content, ics: null };
}

// ---- Invoice email preview -------------------------------------------------

const SAMPLE_PAYMENT_URL = "https://pay.stripe.com/in/sample-cls-0001";

export async function previewInvoiceEmail(
  tutorUid?: string,
): Promise<EmailTemplatePreview> {
  let tutorName = SAMPLE_TUTOR.name;
  let tutorEmail = SAMPLE_TUTOR.email;

  if (tutorUid) {
    try {
      const tutor = await getUserFromFirestore(tutorUid);
      tutorName = tutor.name;
      tutorEmail = tutor.email;
    } catch (error) {
      console.error("previewInvoiceEmail: failed to load tutor, using fallback:", error);
    }
  }

  const invoice = sampleInvoice();
  const input: InvoiceEmailInput = {
    to: SAMPLE_STUDENT.parentEmail ?? SAMPLE_STUDENT.email,
    invoice,
    tutorName,
    tutorEmail,
    paymentUrl: SAMPLE_PAYMENT_URL,
  };
  const content = buildInvoiceEmailContent(input);
  return { ...content, ics: null };
}
