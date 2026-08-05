import { getFirebaseFirestore } from "../config/firebase";
import type {
  CreateRecurringLessonRequest,
  UpdateLessonSeriesRequest,
  LessonSlot,
  DayOfWeek,
  LessonSeries,
  Lesson,
} from "@examify-tms/interfaces";
import { mapLesson, listLessonsBySeriesFromFirestore } from "./lessonService";
import {
  syncLessonToCalendar,
  attachMeetLinkToCalendarEvent,
} from "./googleCalendarService";
import {
  generateMeetLinkForUser,
  GoogleNotConnectedError,
} from "./meetService";
import admin from "firebase-admin";
import crypto from "crypto";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  startOfWeek,
  addWeeks,
  addDays,
  parseISO,
  format,
  isBefore,
  isAfter,
} from "date-fns";

function generateSeriesId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `series_${randomBytes}`;
}

function generateLessonId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `lesson_${randomBytes}`;
}

const DAY_INDEX: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

interface RecurrenceRule {
  startDate: string; // YYYY-MM-DD
  timezone: string;
  intervalWeeks: number;
  slots: LessonSlot[];
  until: string | null; // YYYY-MM-DD inclusive
  count: number | null; // total occurrences
}

/**
 * Expand a recurrence rule into concrete occurrence start times (UTC Dates).
 * Iterates week-by-week from the anchor week; for each "on" week (k %
 * intervalWeeks === 0) emits each slot at its wall-clock time in the series
 * timezone, converted to UTC (DST-stable).
 */
export function generateOccurrences(rule: RecurrenceRule): Date[] {
  const start = parseISO(rule.startDate);
  const week0Monday = startOfWeek(start, { weekStartsOn: 1 });
  const untilDate = rule.until ? parseISO(rule.until) : null;

  const sortedSlots = [...rule.slots].sort(
    (a, b) => DAY_INDEX[a.dayOfWeek] - DAY_INDEX[b.dayOfWeek]
  );

  const occurrences: Date[] = [];
  const MAX_WEEKS = 520; // ~10 year safety cap
  const target = rule.count ?? Number.MAX_SAFE_INTEGER;

  for (let k = 0; k < MAX_WEEKS && occurrences.length < target; k++) {
    if (k % rule.intervalWeeks !== 0) continue;

    const weekMonday = addWeeks(week0Monday, k);

    for (const slot of sortedSlots) {
      if (occurrences.length >= target) break;

      const slotDate = addDays(weekMonday, DAY_INDEX[slot.dayOfWeek]);

      // Drop slots that fall before the anchor start date (e.g. a Monday
      // slot when the arrangement starts on a Wednesday).
      if (isBefore(slotDate, start)) continue;

      // Stop entirely once past the inclusive end date.
      if (untilDate && isAfter(slotDate, untilDate)) {
        return occurrences;
      }

      const localStr = `${format(slotDate, "yyyy-MM-dd")} ${slot.timeOfDay}:00`;
      occurrences.push(fromZonedTime(localStr, rule.timezone));
    }
  }

  return occurrences;
}

/**
 * Map a Firestore series document to a LessonSeries object.
 */
function mapSeries(
  id: string,
  data: admin.firestore.DocumentData
): LessonSeries {
  return {
    id,
    tutorId: data.tutorId,
    studentId: data.studentId,
    subject: data.subject,
    durationMinutes: data.durationMinutes,
    location: data.location ?? null,
    meetLink: data.meetLink ?? null,
    notes: data.notes ?? null,
    intervalWeeks: data.intervalWeeks,
    slots: data.slots,
    timezone: data.timezone,
    startDate: data.startDate,
    until: data.until ?? null,
    count: data.count ?? null,
    acceptanceStatus: data.acceptanceStatus,
    remindersEnabled: data.remindersEnabled,
    createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
  };
}

/**
 * Get a lesson series by ID.
 */
export async function getLessonSeriesByIdFromFirestore(
  seriesId: string
): Promise<LessonSeries | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("lessonSeries").doc(seriesId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;
    return mapSeries(doc.id, data);
  } catch (error) {
    console.error("Failed to get lesson series from Firestore:", error);
    throw new Error("Failed to get lesson series");
  }
}

const MAX_OCCURRENCES = 200;

/**
 * Create a recurring lesson series: write the series document and batch-write
 * all generated occurrences as individual lesson documents.
 */
export async function createLessonSeriesInFirestore(
  data: CreateRecurringLessonRequest,
  tutorId: string
): Promise<{ seriesId: string; count: number }> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const seriesId = generateSeriesId();

    const occurrences = generateOccurrences({
      startDate: data.startDate,
      timezone: data.timezone,
      intervalWeeks: data.intervalWeeks,
      slots: data.slots,
      until: data.until ?? null,
      count: data.count ?? null,
    });

    if (occurrences.length === 0) {
      throw new Error("Recurrence rule produced no occurrences");
    }
    if (occurrences.length > MAX_OCCURRENCES) {
      throw new Error(
        `Recurrence produced ${occurrences.length} occurrences (max ${MAX_OCCURRENCES})`
      );
    }

    // Series document
    const seriesData = {
      tutorId,
      studentId: data.studentId,
      subject: data.subject,
      durationMinutes: data.durationMinutes,
      location: data.location ?? null,
      notes: data.notes ?? null,
      intervalWeeks: data.intervalWeeks,
      slots: data.slots,
      timezone: data.timezone,
      startDate: data.startDate,
      until: data.until ?? null,
      count: data.count ?? null,
      acceptanceStatus: "pending",
      remindersEnabled: data.remindersEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await firestore.collection("lessonSeries").doc(seriesId).set(seriesData);

    // Batch-write occurrences (Firestore batches cap at 500 ops).
    const remindersEnabled = data.remindersEnabled ?? true;
    for (let i = 0; i < occurrences.length; i += 400) {
      const chunk = occurrences.slice(i, i + 400);
      const batch = firestore.batch();
      for (const occ of chunk) {
        const ref = firestore.collection("lessons").doc(generateLessonId());
        batch.set(ref, {
          tutorId,
          studentId: data.studentId,
          subject: data.subject,
          startDateTime: admin.firestore.Timestamp.fromDate(occ),
          durationMinutes: data.durationMinutes,
          location: data.location ?? null,
          meetLink: null,
          notes: data.notes ?? null,
          todos: [],
          acceptanceStatus: "pending",
          attendanceStatus: "unrecorded",
          seriesId,
          isCancelled: false,
          isException: false,
          remindersEnabled,
          isPaid: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    return { seriesId, count: occurrences.length };
  } catch (error) {
    console.error("Failed to create lesson series in Firestore:", error);
    throw error instanceof Error ? error : new Error("Failed to create lesson series");
  }
}

const RULE_FIELDS: (keyof UpdateLessonSeriesRequest)[] = [
  "intervalWeeks",
  "slots",
  "timezone",
  "until",
  "count",
];

/**
 * Update a series template. Template field changes propagate to all future,
 * non-exception occurrences. Changing the recurrence rule itself (slots,
 * cadence, timezone, bounds) is not supported in this version and is rejected.
 */
export async function updateLessonSeriesInFirestore(
  seriesId: string,
  data: UpdateLessonSeriesRequest
): Promise<void> {
  try {
    if (RULE_FIELDS.some((f) => data[f] !== undefined)) {
      throw new Error(
        "Changing the recurrence rule (slots/cadence/timezone/bounds) is not supported yet"
      );
    }

    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const seriesUpdate: Record<string, unknown> = { updatedAt: now };
    if (data.subject !== undefined) seriesUpdate.subject = data.subject;
    if (data.durationMinutes !== undefined)
      seriesUpdate.durationMinutes = data.durationMinutes;
    if (data.location !== undefined) seriesUpdate.location = data.location;
    if (data.notes !== undefined) seriesUpdate.notes = data.notes;
    if (data.remindersEnabled !== undefined)
      seriesUpdate.remindersEnabled = data.remindersEnabled;
    if (data.acceptanceStatus !== undefined)
      seriesUpdate.acceptanceStatus = data.acceptanceStatus;

    await firestore.collection("lessonSeries").doc(seriesId).update(seriesUpdate);

    // Propagate template fields to future, non-exception, non-cancelled
    // occurrences. Query by seriesId only (single-field, no composite index)
    // and filter in memory — a series has bounded occurrences.
    const instanceUpdate: Record<string, unknown> = { updatedAt: now };
    if (data.subject !== undefined) instanceUpdate.subject = data.subject;
    if (data.durationMinutes !== undefined)
      instanceUpdate.durationMinutes = data.durationMinutes;
    if (data.location !== undefined) instanceUpdate.location = data.location;
    if (data.notes !== undefined) instanceUpdate.notes = data.notes;
    if (data.remindersEnabled !== undefined)
      instanceUpdate.remindersEnabled = data.remindersEnabled;
    if (data.acceptanceStatus !== undefined)
      instanceUpdate.acceptanceStatus = data.acceptanceStatus;

    if (Object.keys(instanceUpdate).length > 1) {
      const nowMs = Date.now();
      const snapshot = await firestore
        .collection("lessons")
        .where("seriesId", "==", seriesId)
        .get();

      const future = snapshot.docs.filter((d) => {
        const docData = d.data();
        if (docData.isException) return false;
        if (docData.isCancelled) return false;
        const start = docData.startDateTime;
        if (!start) return false;
        return start.toDate().getTime() >= nowMs;
      });

      for (let i = 0; i < future.length; i += 400) {
        const chunk = future.slice(i, i + 400);
        const batch = firestore.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, instanceUpdate);
        }
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Failed to update lesson series in Firestore:", error);
    throw error instanceof Error ? error : new Error("Failed to update lesson series");
  }
}

/**
 * Persist a shared Google Meet link on a series and propagate it to every
 * non-cancelled occurrence. The Meet conference itself is attached to each
 * upcoming lesson's Google Calendar event by the caller (controller), since
 * this function is storage-only. Past occurrences also receive the `meetLink`
 * string for data consistency, but their calendar events are not touched.
 */
export async function setSeriesMeetLinkInFirestore(
  seriesId: string,
  meetLink: string,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessonSeries")
      .doc(seriesId)
      .update({ meetLink, updatedAt: now });

    // Propagate to every non-cancelled occurrence (single-field seriesId
    // query, filtered in memory — a series has bounded occurrences).
    const snapshot = await firestore
      .collection("lessons")
      .where("seriesId", "==", seriesId)
      .get();

    const targets = snapshot.docs.filter((d) => !d.data()?.isCancelled);

    for (let i = 0; i < targets.length; i += 400) {
      const chunk = targets.slice(i, i + 400);
      const batch = firestore.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, { meetLink, updatedAt: now });
      }
      await batch.commit();
    }
  } catch (error) {
    console.error("Failed to set series Meet link in Firestore:", error);
    throw new Error("Failed to set series Meet link");
  }
}

/** Thrown when a series has no upcoming occurrences to attach a Meet link to. */
export class SeriesNoUpcomingLessonsError extends Error {
  constructor() {
    super("This series has no upcoming lessons to attach a Meet link to");
    this.name = "SeriesNoUpcomingLessonsError";
  }
}

/**
 * True when a lesson/series location value means the tutor wants to use
 * Google Meet. The web flow stores the literal "Google Meet" label, but we
 * match loosely (case-insensitive) so any client setting "Meet" or
 * "google meet" triggers the same behaviour.
 */
export function isMeetLocation(
  location: string | null | undefined,
): boolean {
  return /(^|\s)meet(\s|$)|google\s*meet/i.test(location ?? "");
}

export interface GenerateSeriesMeetResult {
  meetingLink: string;
  appliedTo: number;
  calendarFailed: number;
}

/**
 * Provision ONE shared Google Meet link for an entire series and persist it on
 * the series + every non-cancelled occurrence:
 *   1. Ensure every upcoming occurrence has a backing Google Calendar event.
 *   2. Provision a single Meet conference on the first upcoming lesson's
 *      calendar event (this mints the shared Meet URL).
 *   3. Persist that URL on the series + every non-cancelled occurrence.
 *   4. Attach the same Meet link to each remaining upcoming lesson's calendar
 *      event so every session shows the same "Join" button (best-effort).
 *
 * Throws {@link GoogleNotConnectedError} when the tutor hasn't connected
 * Google, and {@link SeriesNoUpcomingLessonsError} when the series has no
 * upcoming occurrences.
 */
export async function generateSeriesMeetLinkForUser(
  uid: string,
  seriesId: string,
): Promise<GenerateSeriesMeetResult> {
  let upcoming = await listLessonsBySeriesFromFirestore(seriesId, {
    futureOnly: true,
  });
  if (upcoming.length === 0) {
    throw new SeriesNoUpcomingLessonsError();
  }

  // Ensure each upcoming lesson has a Google Calendar event so we can attach
  // the Meet conference to it. Best-effort; failures are logged.
  await Promise.allSettled(upcoming.map((l) => syncLessonToCalendar(uid, l)));

  // Reload to pick up fresh googleCalendarEventIds from the sync above.
  upcoming = await listLessonsBySeriesFromFirestore(seriesId, {
    futureOnly: true,
  });

  const first = upcoming[0];

  // Provision the shared Meet link on the first lesson's calendar event.
  // generateMeetLinkForUser attaches conferenceData to the lesson's existing
  // event (or creates one) and returns the minted Meet URL.
  const { meetingLink } = await generateMeetLinkForUser(uid, {
    lessonId: first.id,
  });

  // Persist the shared link on the series + all non-cancelled lessons.
  await setSeriesMeetLinkInFirestore(seriesId, meetingLink);

  // Attach the same Meet link to every OTHER upcoming lesson's event.
  // Best-effort: a single event failing must not roll back the rest.
  const others = upcoming.filter(
    (l) => l.id !== first.id && l.googleCalendarEventId,
  );
  const results = await Promise.allSettled(
    others.map((l) =>
      attachMeetLinkToCalendarEvent(uid, l.googleCalendarEventId, meetingLink),
    ),
  );
  const calendarFailed = results.filter(
    (r) => r.status === "rejected",
  ).length;
  if (calendarFailed > 0) {
    console.error(
      `[series-meet] ${calendarFailed}/${others.length} calendar events could not be updated for series ${seriesId}`,
    );
  }

  return { meetingLink, appliedTo: upcoming.length, calendarFailed };
}

/**
 * Cancel all future, non-cancelled occurrences of a series (soft cancel).
 * Past occurrences and history are preserved.
 */
export async function cancelLessonSeriesFuture(
  seriesId: string
): Promise<number> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const nowMs = Date.now();

    const snapshot = await firestore
      .collection("lessons")
      .where("seriesId", "==", seriesId)
      .get();

    const future = snapshot.docs.filter((d) => {
      const docData = d.data();
      if (docData.isCancelled) return false;
      const start = docData.startDateTime;
      if (!start) return false;
      return start.toDate().getTime() >= nowMs;
    });

    for (let i = 0; i < future.length; i += 400) {
      const chunk = future.slice(i, i + 400);
      const batch = firestore.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, { isCancelled: true, updatedAt: now });
      }
      await batch.commit();
    }

    return future.length;
  } catch (error) {
    console.error("Failed to cancel lesson series in Firestore:", error);
    throw new Error("Failed to cancel lesson series");
  }
}

/** Map an English weekday name to the DayOfWeek enum value. */
const WEEKDAY_TO_DOW: Record<string, DayOfWeek> = {
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
};

/**
 * Derive the IANA day-of-week (monday…sunday) of a UTC instant as it falls in
 * the given timezone. Uses date-fns-tz so DST is handled correctly.
 */
export function dayOfWeekInTz(date: Date, tz: string): DayOfWeek {
  const name = formatInTimeZone(date, tz, "EEEE").toLowerCase();
  return WEEKDAY_TO_DOW[name] ?? "monday";
}

/** Derive the "HH:mm" wall-clock time of a UTC instant in the given timezone. */
export function timeOfDayInTz(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "HH:mm");
}

/**
 * Read-only preview of the slot transformation performed by
 * {@link rescheduleSeriesFromOccurrence}: replace the series slot matching the
 * old occurrence's day with the new day/time, leaving all other slots
 * unchanged. Returns the resulting slot list without mutating anything.
 */
export function previewRescheduledSlots(
  slots: LessonSlot[],
  oldStart: Date,
  newStart: Date,
  tz: string,
): LessonSlot[] {
  const oldDay = dayOfWeekInTz(oldStart, tz);
  const newDay = dayOfWeekInTz(newStart, tz);
  const newTime = timeOfDayInTz(newStart, tz);
  let replaced = false;
  const updated = slots.map((slot) => {
    if (slot.dayOfWeek === oldDay && !replaced) {
      replaced = true;
      return { dayOfWeek: newDay, timeOfDay: newTime };
    }
    return slot;
  });
  if (!replaced) updated.push({ dayOfWeek: newDay, timeOfDay: newTime });
  return updated;
}

/**
 * Hard-delete the series document and all its future (un-taught) occurrence
 * lesson docs. Past/attended lessons are preserved for history & billing.
 * Returns the deleted future lessons so the caller can clean up Google
 * Calendar events and (optionally) notify the student.
 */
export async function deleteSeriesAndFuture(
  seriesId: string,
): Promise<Lesson[]> {
  try {
    const firestore = getFirebaseFirestore();
    const nowMs = Date.now();

    const snapshot = await firestore
      .collection("lessons")
      .where("seriesId", "==", seriesId)
      .get();

    const futureDocs = snapshot.docs.filter((d) => {
      const start = d.data()?.startDateTime;
      if (!start) return false;
      return start.toDate().getTime() >= nowMs;
    });

    const removed = futureDocs.map((d) => mapLesson(d.id, d.data()));

    for (let i = 0; i < futureDocs.length; i += 400) {
      const chunk = futureDocs.slice(i, i + 400);
      const batch = firestore.batch();
      for (const doc of chunk) batch.delete(doc.ref);
      await batch.commit();
    }

    await firestore.collection("lessonSeries").doc(seriesId).delete();

    return removed;
  } catch (error) {
    console.error("Failed to delete lesson series:", error);
    throw new Error("Failed to delete lesson series");
  }
}

interface RescheduleSeriesResult {
  removed: Lesson[];
  created: Lesson[];
}

/**
 * Reschedule a series from a single occurrence forward: update the matching
 * slot to the new day/time, delete all future non-exception occurrences, and
 * regenerate them from the updated rule. Past lessons and individually-edited
 * exceptions are preserved.
 *
 * Returns the removed and created lessons so the caller can sync Google
 * Calendar and (optionally) notify the student.
 */
export async function rescheduleSeriesFromOccurrence(
  seriesId: string,
  oldStart: Date,
  newStart: Date,
  durationMinutesOverride?: number | null,
): Promise<RescheduleSeriesResult> {
  try {
    const series = await getLessonSeriesByIdFromFirestore(seriesId);
    if (!series) throw new Error("Lesson series not found");

    const tz = series.timezone;
    const firestore = getFirebaseFirestore();
    const nowMs = Date.now();
    const now = admin.firestore.Timestamp.now();

    // Derive the old slot's day-of-week and the new slot's day + time, all in
    // the series timezone so the regeneration stays DST-stable.
    const oldDay = dayOfWeekInTz(oldStart, tz);
    const newDay = dayOfWeekInTz(newStart, tz);
    const newTime = timeOfDayInTz(newStart, tz);

    // Replace the matching slot; keep all other slots unchanged.
    let slotReplaced = false;
    const updatedSlots: LessonSlot[] = series.slots.map((slot) => {
      if (slot.dayOfWeek === oldDay && !slotReplaced) {
        slotReplaced = true;
        return { dayOfWeek: newDay, timeOfDay: newTime };
      }
      return slot;
    });
    // If the old day wasn't found (edge case), append the new slot.
    if (!slotReplaced) {
      updatedSlots.push({ dayOfWeek: newDay, timeOfDay: newTime });
    }

    const newDuration = durationMinutesOverride ?? series.durationMinutes;

    // Load all lessons, identify future non-exception non-cancelled ones to
    // delete (regenerate them with the new time).
    const snapshot = await firestore
      .collection("lessons")
      .where("seriesId", "==", seriesId)
      .get();

    const toRemove = snapshot.docs.filter((d) => {
      const data = d.data();
      if (data.isCancelled) return false;
      if (data.isException) return false;
      const start = data.startDateTime;
      if (!start) return false;
      return start.toDate().getTime() >= nowMs;
    });

    const removed = toRemove.map((d) => mapLesson(d.id, d.data()));

    for (let i = 0; i < toRemove.length; i += 400) {
      const chunk = toRemove.slice(i, i + 400);
      const batch = firestore.batch();
      for (const doc of chunk) batch.delete(doc.ref);
      await batch.commit();
    }

    // Regenerate from the current week with the updated rule.
    const todayStr = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    const occurrences = generateOccurrences({
      startDate: todayStr,
      timezone: tz,
      intervalWeeks: series.intervalWeeks,
      slots: updatedSlots,
      until: series.until ?? null,
      count: series.count ?? null,
    });

    if (occurrences.length > MAX_OCCURRENCES) {
      throw new Error(
        `Reschedule produced ${occurrences.length} occurrences (max ${MAX_OCCURRENCES})`,
      );
    }

    const created: Lesson[] = [];
    for (let i = 0; i < occurrences.length; i += 400) {
      const chunk = occurrences.slice(i, i + 400);
      const batch = firestore.batch();
      for (const occ of chunk) {
        const lessonId = generateLessonId();
        const ref = firestore.collection("lessons").doc(lessonId);
        batch.set(ref, {
          tutorId: series.tutorId,
          studentId: series.studentId,
          subject: series.subject,
          startDateTime: admin.firestore.Timestamp.fromDate(occ),
          durationMinutes: newDuration,
          location: series.location ?? null,
          meetLink: null,
          notes: series.notes ?? null,
          todos: [],
          acceptanceStatus: "pending",
          attendanceStatus: "unrecorded",
          seriesId,
          isCancelled: false,
          isException: false,
          remindersEnabled: series.remindersEnabled,
          isPaid: false,
          createdAt: now,
          updatedAt: now,
        });
        created.push({
          id: lessonId,
          tutorId: series.tutorId,
          studentId: series.studentId,
          subject: series.subject,
          startDateTime: occ as any,
          durationMinutes: newDuration,
          location: series.location ?? null,
          notes: series.notes ?? null,
          todos: [],
          acceptanceStatus: "pending",
          attendanceStatus: "unrecorded",
          seriesId,
          isCancelled: false,
          isException: false,
          remindersEnabled: series.remindersEnabled,
          lastStudentNotifiedAt: null as any,
          studentNotifiedCount: 0,
          isPaid: false,
          invoiceId: null,
          googleCalendarEventId: null,
          googleCalendarSyncedAt: null as any,
          icsUid: null,
          rsvpTokenVersion: 0,
          createdAt: now.toDate() as any,
          updatedAt: now.toDate() as any,
        });
      }
      await batch.commit();
    }

    // Update the series rule so future edits reflect the new slot + duration.
    await firestore.collection("lessonSeries").doc(seriesId).update({
      slots: updatedSlots,
      durationMinutes: newDuration,
      updatedAt: now,
    });

    return { removed, created };
  } catch (error) {
    console.error("Failed to reschedule lesson series:", error);
    throw error instanceof Error ? error : new Error("Failed to reschedule lesson series");
  }
}
