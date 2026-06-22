import { google, calendar_v3 } from "googleapis";
import { getOAuth2ClientForUser } from "../config/googleOAuth";
import { getGoogleConnection } from "./userService";
import { getStudentByIdFromFirestore } from "./studentService";
import {
  listLessonsFromFirestore,
  setLessonGoogleEventId,
} from "./lessonService";
import { Lesson, ExternalCalendarEvent } from "@examify-tms/interfaces";

/**
 * Marker stamped into every Google Calendar event we create for a lesson,
 * via `extendedProperties.private`. Lets the inbound list query exclude our
 * own events so lessons don't appear twice on the Schedule.
 */
export const EXAMIFY_SOURCE = "examify-tms-lesson";

/** The tutor's primary calendar is the only one we sync with. */
const PRIMARY_CALENDAR_ID = "primary";

/** Thrown when a tutor hasn't connected their Google account yet. */
export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Connect your Google account first.");
    this.name = "GoogleNotConnectedError";
  }
}

/**
 * Resolve an authenticated calendar client for the tutor, or null when they
 * have no stored Google connection.
 */
async function getCalendarForUser(
  uid: string,
): Promise<{ cal: calendar_v3.Calendar; email: string | null } | null> {
  const connection = await getGoogleConnection(uid);
  if (!connection) return null;
  const auth = getOAuth2ClientForUser(connection.refreshToken);
  return {
    cal: google.calendar({ version: "v3", auth }),
    email: connection.googleEmail,
  };
}

/** Build a human-readable event summary for a lesson ("Maths — Jane"). */
async function buildLessonSummary(
  lesson: Lesson,
): Promise<{ summary: string; description: string }> {
  const student = lesson.studentId
    ? await getStudentByIdFromFirestore(lesson.studentId)
    : null;
  const studentName = student?.name;
  const summary = studentName
    ? ` ${studentName} — ${lesson.subject}`
    : lesson.subject;
  const description = "Lesson managed by Clastor";
  return { summary, description };
}

/** Convert a lesson (Date/string start) into Google start/end datetime blocks. */
function lessonToStartEnd(lesson: Lesson) {
  const start = new Date(lesson.startDateTime as any);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  return {
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

/**
 * Create a Google Calendar event on the tutor's primary calendar for a lesson.
 * The event is tagged with extendedProperties so inbound sync can skip it.
 *
 * @returns The new Google event id, or null if the tutor isn't connected.
 */
export async function createLessonCalendarEvent(
  uid: string,
  lesson: Lesson,
): Promise<string | null> {
  const ctx = await getCalendarForUser(uid);
  if (!ctx) return null;

  const { summary, description } = await buildLessonSummary(lesson);
  const { start, end } = lessonToStartEnd(lesson);

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    description,
    location: lesson.location ?? undefined,
    start,
    end,
    colorId: "1",
    extendedProperties: {
      private: {
        examifySource: EXAMIFY_SOURCE,
        lessonId: lesson.id,
      },
    },
  };

  const insert = await ctx.cal.events.insert({
    calendarId: PRIMARY_CALENDAR_ID,
    requestBody,
  });

  const eventId = insert.data.id;
  if (!eventId) {
    throw new Error("Google Calendar did not return an event id.");
  }
  return eventId;
}

/**
 * Patch the Google Calendar event for a lesson (time/subject/location/student).
 * Requires the lesson to already have a googleCalendarEventId.
 */
export async function updateLessonCalendarEvent(
  uid: string,
  lesson: Lesson,
): Promise<void> {
  if (!lesson.googleCalendarEventId) return;
  const ctx = await getCalendarForUser(uid);
  if (!ctx) return;

  const { summary, description } = await buildLessonSummary(lesson);
  const { start, end } = lessonToStartEnd(lesson);

  await ctx.cal.events.patch({
    calendarId: PRIMARY_CALENDAR_ID,
    eventId: lesson.googleCalendarEventId,
    requestBody: {
      summary,
      description,
      location: lesson.location ?? undefined,
      start,
      end,
    },
  });
}

/**
 * Delete the Google Calendar event for a lesson (used on cancel/disconnect).
 * No-op if the tutor isn't connected or the lesson has no event id.
 */
export async function deleteLessonCalendarEvent(
  uid: string,
  googleCalendarEventId: string | null | undefined,
): Promise<void> {
  if (!googleCalendarEventId) return;
  const ctx = await getCalendarForUser(uid);
  if (!ctx) return;

  await ctx.cal.events.delete({
    calendarId: PRIMARY_CALENDAR_ID,
    eventId: googleCalendarEventId,
  });
}

/**
 * Best-effort push of a lesson to Google Calendar:
 *  - If the lesson already has a googleCalendarEventId, patch it.
 *  - Otherwise create a new event and persist the returned id.
 *
 * Never throws on Google errors (logs only) — lesson operations must not be
 * blocked by sync failures. Throws GoogleNotConnectedError when not connected
 * so callers can distinguish "skipped (not connected)" from "attempted".
 */
export async function syncLessonToCalendar(
  uid: string,
  lesson: Lesson,
): Promise<void> {
  try {
    if (lesson.googleCalendarEventId) {
      await updateLessonCalendarEvent(uid, lesson);
    } else {
      const eventId = await createLessonCalendarEvent(uid, lesson);
      if (eventId) {
        await setLessonGoogleEventId(lesson.id, eventId);
      }
    }
  } catch (error) {
    console.error(
      `[calendar-sync] Failed to sync lesson ${lesson.id} for ${uid}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Fetch external (non-lesson) events from the tutor's primary Google Calendar
 * for the given window, excluding events Examify created. Timed events only
 * (all-day events are skipped for now).
 *
 * @throws {GoogleNotConnectedError} when the tutor hasn't connected Google.
 */
export async function listExternalCalendarEvents(
  uid: string,
  from: Date,
  to: Date,
): Promise<ExternalCalendarEvent[]> {
  const ctx = await getCalendarForUser(uid);
  if (!ctx) throw new GoogleNotConnectedError();

  const res = await ctx.cal.events.list({
    calendarId: PRIMARY_CALENDAR_ID,
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const items = res.data.items ?? [];
  const external: ExternalCalendarEvent[] = [];

  for (const item of items) {
    // Skip cancelled events.
    if (item.status === "cancelled") continue;
    // Skip events we created (lesson sync) so lessons aren't double-shown.
    if (item.extendedProperties?.private?.examifySource === EXAMIFY_SOURCE) {
      continue;
    }
    // Skip all-day events (no dateTime) for now.
    const startDt = item.start?.dateTime;
    const endDt = item.end?.dateTime;
    if (!startDt || !endDt) continue;

    external.push({
      id: item.id ?? "",
      title: item.summary || "(Untitled)",
      startDateTime: startDt,
      endDateTime: endDt,
      location: item.location ?? null,
      isAllDay: false,
    });
  }

  return external;
}

/**
 * Push all upcoming, non-cancelled lessons that aren't yet on Google Calendar
 * to the tutor's primary calendar. Skips lessons that already have a
 * googleCalendarEventId. Used on first connect and from the manual "Sync"
 * button.
 *
 * @returns counts of pushed and skipped lessons.
 * @throws {GoogleNotConnectedError} when the tutor isn't connected.
 */
export async function backfillUpcomingLessons(
  uid: string,
): Promise<{ pushed: number; skipped: number }> {
  // Confirm a connection exists before doing any work.
  const connection = await getGoogleConnection(uid);
  if (!connection) throw new GoogleNotConnectedError();

  const now = new Date();
  const lessons = await listLessonsFromFirestore(uid, "tutor", {
    from: now,
  });

  let pushed = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    if (lesson.isCancelled) {
      skipped++;
      continue;
    }
    if (lesson.googleCalendarEventId) {
      skipped++;
      continue;
    }
    try {
      const eventId = await createLessonCalendarEvent(uid, lesson);
      if (eventId) {
        await setLessonGoogleEventId(lesson.id, eventId);
        pushed++;
      }
    } catch (error) {
      console.error(
        `[calendar-backfill] Failed to push lesson ${lesson.id}:`,
        error instanceof Error ? error.message : error,
      );
      skipped++;
    }
  }

  return { pushed, skipped };
}
