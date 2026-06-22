import ical, {
  ICalCalendarData,
  ICalCalendarMethod,
} from "ical-generator";

/**
 * Build a calendar invite (iCalendar `METHOD:REQUEST`) for a lesson.
 *
 * The invite is attached to the notify-student email so it lands on the
 * student's calendar as a real meeting request. The UID is the lesson's
 * stable `icsUid`, so resends with a bumped SEQUENCE update the same event
 * rather than creating duplicates. The student is added as an attendee with
 * `RSVP=TRUE`; the organizer is the tutor.
 */
export interface LessonInviteInput {
  icsUid: string;
  /** Bumped on each resend so calendar clients treat it as an update. */
  sequence: number;
  summary: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
  organizer: { name: string; email?: string | null };
  attendee: { name: string; email: string };
}

/**
 * Generate the iCal string for a lesson invite, including METHOD:REQUEST.
 */
export function buildLessonInvite(input: LessonInviteInput): string {
  const cal = ical({
    name: "Clastor",
    prodId: {
      company: "Clastor",
      product: "Lesson Scheduler",
      language: "EN",
    },
    method: ICalCalendarMethod.REQUEST,
  } satisfies ICalCalendarData);

  cal.createEvent({
    id: input.icsUid,
    sequence: input.sequence,
    start: input.start,
    end: input.end,
    stamp: new Date(),
    summary: input.summary,
    location: input.location || undefined,
    description: input.description || undefined,
    organizer: {
      name: input.organizer.name,
      email: input.organizer.email || undefined,
    },
    attendees: [
      {
        name: input.attendee.name,
        email: input.attendee.email,
        rsvp: true,
      },
    ],
  });

  return cal.toString();
}
