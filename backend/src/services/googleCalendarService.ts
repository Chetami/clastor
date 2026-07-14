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

/**
 * True when a Google Calendar API error indicates the target event no longer
 * exists — either soft-deleted (404) or permanently purged from trash (410).
 * Used to detect a stale stored googleCalendarEventId after a tutor deletes
 * the event over on Google's side, so we can recreate it.
 */
function isGoogleEventNotFound(error: unknown): boolean {
  const code =
    (error as { code?: number; response?: { status?: number } } | null)?.code ??
    (error as { response?: { status?: number } } | null)?.response?.status;
  return code === 404 || code === 410;
}

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
  const summary = lesson.subject
    ? (studentName ? `${studentName} — ${lesson.subject}` : lesson.subject)
    : studentName || "Lesson";
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
 * Resolve the location label to push to Google Calendar. Uses the lesson's
 * display location (e.g. "Google Meet"), NOT the raw Meet URL — the Meet
 * conference is attached separately via conferenceData, so putting the URL
 * here too would show a duplicate on Google Calendar.
 */
function lessonLocationForCalendar(lesson: Lesson): string | undefined {
  return lesson.location ?? undefined;
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
    location: lessonLocationForCalendar(lesson),
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
      location: lessonLocationForCalendar(lesson),
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
 *  - If the lesson already has a googleCalendarEventId, patch it. If the patch
 *    reveals the event was deleted over on Google (404/410), transparently
 *    recreate it and persist the new id (self-heal).
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
      try {
        await updateLessonCalendarEvent(uid, lesson);
        return;
      } catch (error) {
        if (!isGoogleEventNotFound(error)) throw error;
        // The stored event id is stale (deleted on Google's side) — clear it
        // and fall through to create a fresh event (self-heal).
        await setLessonGoogleEventId(lesson.id, null);
      }
    }
    const eventId = await createLessonCalendarEvent(uid, lesson);
    if (eventId) {
      await setLessonGoogleEventId(lesson.id, eventId);
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
 * Push all upcoming, non-cancelled lessons to Google Calendar, reconciling
 * against events that already exist. Used on first connect and from the
 * manual "Sync" button. For each upcoming lesson:
 *   - No stored id            → create (pushed)
 *   - Stored id but gone      → recreate, update id (recovered)
 *   - Stored id & still live  → skip (skipped)
 *
 * Liveness is established with a single events.list over the window
 * [now, latest upcoming lesson start] (default +1yr), so the whole pass costs
 * one list call plus one create per missing/absent lesson.
 *
 * @returns counts of pushed, recovered and skipped lessons.
 * @throws {GoogleNotConnectedError} when the tutor isn't connected.
 */
export async function backfillUpcomingLessons(
  uid: string,
): Promise<{ pushed: number; recovered: number; skipped: number }> {
  // Confirm a connection exists before doing any work.
  const connection = await getGoogleConnection(uid);
  if (!connection) throw new GoogleNotConnectedError();

  const now = new Date();
  const lessons = (await listLessonsFromFirestore(uid, "tutor", {
    from: now,
  })).filter((l) => !l.isCancelled);

  if (lessons.length === 0) {
    return { pushed: 0, recovered: 0, skipped: 0 };
  }

  // Window end = the latest upcoming lesson start, or ~1yr out as a fallback.
  const latestStart = lessons.reduce((max, l) => {
    const t = new Date(l.startDateTime as any).getTime();
    return t > max ? t : max;
  }, 0);
  const windowEnd = new Date(
    Math.max(latestStart, now.getTime()) + 60 * 1000,
  );

  // Set of Examify-created event ids that still exist on Google.
  const liveIds = await listOwnCalendarEventIds(uid, now, windowEnd);

  let pushed = 0;
  let recovered = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const existingId = lesson.googleCalendarEventId;
    const isLive = existingId ? liveIds.has(existingId) : false;

    if (existingId && isLive) {
      skipped++;
      continue;
    }

    try {
      const eventId = await createLessonCalendarEvent(uid, lesson);
      if (eventId) {
        await setLessonGoogleEventId(lesson.id, eventId);
        if (existingId) {
          recovered++;
        } else {
          pushed++;
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(
        `[calendar-backfill] Failed to push lesson ${lesson.id}:`,
        error instanceof Error ? error.message : error,
      );
      skipped++;
    }
  }

  return { pushed, recovered, skipped };
}

/**
 * Fetch the ids of all Examify-created (lesson) events that currently exist
 * on the tutor's primary calendar within [from, to]. Used by reconciliation
 * to detect lessons whose stored googleCalendarEventId points at a
 * since-deleted event.
 *
 * @throws {GoogleNotConnectedError} when the tutor isn't connected.
 */
async function listOwnCalendarEventIds(
  uid: string,
  from: Date,
  to: Date,
): Promise<Set<string>> {
  const ctx = await getCalendarForUser(uid);
  if (!ctx) throw new GoogleNotConnectedError();

  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await ctx.cal.events.list({
      calendarId: PRIMARY_CALENDAR_ID,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      maxResults: 250,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      if (item.status === "cancelled") continue;
      if (item.extendedProperties?.private?.examifySource !== EXAMIFY_SOURCE) {
        continue;
      }
      if (item.id) ids.add(item.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

export type ResyncAction = "created" | "updated" | "recreated";

/**
 * Force a single lesson's Google Calendar event to exist and match:
 *   - No stored id                 → create (action "created")
 *   - Stored id, event still live  → patch in place (action "updated")
 *   - Stored id but gone (404/410) → recreate + store new id (action "recreated")
 *
 * Unlike syncLessonToCalendar this throws on Google failures so the caller
 * (a manual user action) gets feedback; it never swallows.
 *
 * @throws {GoogleNotConnectedError} when the tutor isn't connected.
 */
export async function resyncLessonCalendar(
  uid: string,
  lesson: Lesson,
): Promise<{ action: ResyncAction; eventId: string | null }> {
  const ctx = await getCalendarForUser(uid);
  if (!ctx) throw new GoogleNotConnectedError();

  // Verify the stored event still exists (if any).
  if (lesson.googleCalendarEventId) {
    try {
      await ctx.cal.events.get({
        calendarId: PRIMARY_CALENDAR_ID,
        eventId: lesson.googleCalendarEventId,
      });
      // It exists — patch it to match current lesson data.
      await updateLessonCalendarEvent(uid, lesson);
      return { action: "updated", eventId: lesson.googleCalendarEventId };
    } catch (error) {
      if (!isGoogleEventNotFound(error)) throw error;
      // Gone — clear the stale id and recreate below.
      await setLessonGoogleEventId(lesson.id, null);
    }
  }

  const eventId = await createLessonCalendarEvent(uid, lesson);
  if (eventId) {
    await setLessonGoogleEventId(lesson.id, eventId);
  }
  return { action: lesson.googleCalendarEventId ? "recreated" : "created", eventId };
}
