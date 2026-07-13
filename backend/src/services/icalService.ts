import ical, {
  ICalCalendarData,
  ICalCalendarMethod,
  ICalEventStatus,
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
  /**
   * IANA timezone identifier the lesson is booked in (e.g.
   * "Australia/Sydney"). When set, the event is emitted with a TZID so
   * calendar clients render it in the tutor's local time and honour DST.
   * Null/undefined emits floating UTC times (the previous behaviour).
   */
  timezone?: string | null;
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
    timezone: input.timezone || undefined,
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

/**
 * Generate a cancellation iCal (`METHOD:CANCEL`, event status `CANCELLED`) for
 * a lesson. Attached to the cancellation email so the student's calendar
 * client removes the previously-added event. Uses the same stable UID as the
 * original invite, with a SEQUENCE higher than the last REQUEST (bumped by the
 * caller) so clients treat it as an update rather than a new event.
 */
export function buildLessonCancellation(input: LessonInviteInput): string {
  const cal = ical({
    name: "Clastor",
    prodId: {
      company: "Clastor",
      product: "Lesson Scheduler",
      language: "EN",
    },
    method: ICalCalendarMethod.CANCEL,
  } satisfies ICalCalendarData);

  cal.createEvent({
    id: input.icsUid,
    sequence: input.sequence,
    start: input.start,
    end: input.end,
    stamp: new Date(),
    summary: input.summary,
    timezone: input.timezone || undefined,
    location: input.location || undefined,
    description: input.description || undefined,
    status: ICalEventStatus.CANCELLED,
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
