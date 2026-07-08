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
  type LessonNotificationInput,
  type LessonCancellationInput,
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
    id: "invoice",
    name: "Invoice",
    type: "pdf",
    description:
      "PDF attached to the invoice email sent to a parent or billing contact.",
  },
  {
    id: "lesson-reminder",
    name: "Lesson reminder",
    type: "email",
    description:
      "Reminder emailed to a student before a lesson, with the lesson details.",
  },
  {
    id: "meet-invite",
    name: "Google Meet invite",
    type: "email",
    description:
      "Lesson reminder that also carries a calendar invite with a Google Meet link and RSVP buttons.",
  },
  {
    id: "reschedule",
    name: "Reschedule notice",
    type: "email",
    description:
      "Sent automatically when you reschedule a lesson with “notify student” on — an updated invite with the new time.",
  },
  {
    id: "cancellation",
    name: "Cancellation notice",
    type: "email",
    description:
      "Sent when you cancel a lesson and choose to notify the student — removes the event from their calendar.",
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
}

function sampleLessonInput({
  withMeet,
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

export function previewLessonReminder(): EmailTemplatePreview {
  const { input } = sampleLessonInput({ withMeet: false });
  return {
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
    ics: null,
  };
}

export function previewMeetInvite(): EmailTemplatePreview {
  const { input, ics } = sampleLessonInput({ withMeet: true });
  return {
    subject: buildLessonNotificationSubject(input),
    text: buildLessonNotificationBody(input),
    html: buildLessonNotificationHtml(input),
    ics: ics ?? null,
  };
}

export function previewReschedule(): EmailTemplatePreview {
  const { input, ics } = sampleLessonInput({ withMeet: true });
  // Mirrors dispatchLessonNotification({ reason: "reschedule" }): the subject
  // becomes "Lesson time updated" and the greeting notes the time change.
  const rescheduleInput: LessonNotificationInput = {
    ...input,
    reason: "reschedule",
    message: `Hi ${input.studentName},\n\nThe time for our upcoming lesson has changed. The updated details are below.`,
  };
  return {
    subject: buildLessonNotificationSubject(rescheduleInput),
    text: buildLessonNotificationBody(rescheduleInput),
    html: buildLessonNotificationHtml(rescheduleInput),
    ics: ics ?? null,
  };
}

export function previewCancellation(): EmailTemplatePreview {
  const { input } = sampleLessonInput({ withMeet: false });
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
