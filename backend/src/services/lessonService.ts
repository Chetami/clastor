import { getFirebaseFirestore } from "../config/firebase";
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  AttendanceStatus,
  LessonAcceptance,
  Lesson,
  ListLessonsQuery,
} from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

/** Default page size for the cursor-paginated lessons list. */
const DEFAULT_PAGE_SIZE = 10;

/** Attendance values that represent a tutor cancellation. */
const TUTOR_CANCELLED_ATTENDANCE: readonly AttendanceStatus[] = [
  "tutor_cancelled",
  "tutor_cancelled_makeup_issued",
];

/**
 * Generate a unique lesson ID with prefix
 * @returns Lesson ID (e.g., lesson_a1b2c3d4e5f6)
 */
function generateLessonId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `lesson_${randomBytes}`;
}

/**
 * Map a Firestore lesson document to a Lesson object
 */
export function mapLesson(id: string, data: admin.firestore.DocumentData): Lesson {
  return {
    id,
    tutorId: data.tutorId,
    studentId: data.studentId,
    subject: data.subject,
    startDateTime: data.startDateTime ? data.startDateTime.toDate() : (null as any),
    durationMinutes: data.durationMinutes,
    location: data.location ?? null,
    meetLink: data.meetLink ?? null,
    notes: data.notes ?? null,
    todos: data.todos ?? [],
    acceptanceStatus: data.acceptanceStatus,
    attendanceStatus: data.attendanceStatus,
    seriesId: data.seriesId ?? null,
    isCancelled: data.isCancelled ?? false,
    isException: data.isException ?? false,
    remindersEnabled: data.remindersEnabled,
    lastStudentNotifiedAt: data.lastStudentNotifiedAt
      ? data.lastStudentNotifiedAt.toDate()
      : (null as any),
    studentNotifiedCount: data.studentNotifiedCount ?? 0,
    isPaid: data.isPaid ?? false,
    invoiceId: data.invoiceId ?? null,
    googleCalendarEventId: data.googleCalendarEventId ?? null,
    googleCalendarSyncedAt: data.googleCalendarSyncedAt
      ? data.googleCalendarSyncedAt.toDate()
      : (null as any),
    icsUid: data.icsUid ?? null,
    rsvpTokenVersion: data.rsvpTokenVersion ?? 0,
    createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
  };
}

export interface LessonFilters {
  from?: Date;
  to?: Date;
  studentId?: string;
  acceptanceStatus?: string;
  attendanceStatus?: string;
  unpaid?: boolean;
}

/**
 * List lesson documents from Firestore, scoped to the authenticated user.
 *
 * The date window (`from`/`to`) is pushed into the Firestore query so the
 * calendar and Google sync only read lessons inside the window rather than
 * the tutor's entire history. The remaining filters (student, acceptance,
 * attendance, unpaid) are applied in memory; the result is sorted ascending
 * by start time.
 */
export async function listLessonsFromFirestore(
  userId: string,
  role: string,
  filters: LessonFilters = {}
): Promise<Lesson[]> {
  try {
    const firestore = getFirebaseFirestore();

    let query: admin.firestore.Query = firestore.collection("lessons");
    if (role === "tutor") {
      query = query.where("tutorId", "==", userId);
    } else if (role === "system_admin") {
      // admins see all lessons
    } else {
      throw new Error("Invalid role");
    }

    // A range filter on startDateTime requires an orderBy on the same field.
    if (filters.from) {
      query = query.where(
        "startDateTime",
        ">=",
        admin.firestore.Timestamp.fromDate(filters.from)
      );
    }
    if (filters.to) {
      query = query.where(
        "startDateTime",
        "<",
        admin.firestore.Timestamp.fromDate(filters.to)
      );
    }
    if (filters.from || filters.to) {
      query = query.orderBy("startDateTime", "asc");
    }

    const snapshot = await query.get();

    const lessons: Lesson[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const lesson = mapLesson(doc.id, data);

      // Remaining filters are applied in memory.
      if (filters.studentId && lesson.studentId !== filters.studentId) return;
      if (
        filters.acceptanceStatus &&
        lesson.acceptanceStatus !== filters.acceptanceStatus
      )
        return;
      if (
        filters.attendanceStatus &&
        lesson.attendanceStatus !== filters.attendanceStatus
      )
        return;
      if (filters.unpaid && (lesson.isPaid || lesson.invoiceId)) return;

      lessons.push(lesson);
    });

    // Sort ascending by start time (a no-op when the query already ordered
    // by startDateTime, but required when no window was supplied).
    lessons.sort(
      (a, b) =>
        new Date(a.startDateTime as any).getTime() -
        new Date(b.startDateTime as any).getTime()
    );

    return lessons;
  } catch (error) {
    console.error("Failed to list lessons from Firestore:", error);
    throw new Error("Failed to list lessons");
  }
}

export type LessonStatusFilter = "upcoming" | "past" | "cancelled" | "all";

export interface LessonPageQuery {
  status?: LessonStatusFilter;
  limit?: number;
  cursor?: string;
}

export interface LessonPageResult {
  data: Lesson[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface LessonCursor {
  s: string; // ISO startDateTime of the last doc on the previous page
  id: string; // document id (tiebreaker)
}

const CURSOR_ENCODING = "base64url";

/** Encode an opaque pagination cursor from a lesson. */
export function encodeCursor(lesson: Lesson): string {
  const payload: LessonCursor = {
    s: new Date(lesson.startDateTime as any).toISOString(),
    id: lesson.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString(CURSOR_ENCODING);
}

/** Decode + validate an opaque pagination cursor. Throws on malformed input. */
export function decodeCursor(cursor: string): LessonCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(cursor, CURSOR_ENCODING).toString("utf8")
    );
  } catch {
    throw new Error("Invalid cursor");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as LessonCursor).s !== "string" ||
    typeof (parsed as LessonCursor).id !== "string"
  ) {
    throw new Error("Invalid cursor");
  }
  const decoded = parsed as LessonCursor;
  if (Number.isNaN(new Date(decoded.s).getTime())) {
    throw new Error("Invalid cursor");
  }
  return decoded;
}

/**
 * Cursor-paginated lesson listing for the lessons page.
 *
 * Each status bucket maps to a single Firestore query that the server can
 * satisfy from a composite index, reading only ~`limit` documents per page
 * (one extra is fetched to detect a following page). Ordering is implicit
 * per bucket so it is indexable alongside the date range:
 *   - upcoming  → startDateTime ascending  (soonest first)
 *   - past      → startDateTime descending (most recent first)
 *   - cancelled → startDateTime descending
 *   - all       → startDateTime descending
 *
 * A document-id tiebreaker is appended to the orderBy so pages are stable
 * even when several lessons share the same start time. The cursor carries
 * the last document's (startDateTime, id) pair.
 *
 * `isCancelled` is treated as the single source of truth for "cancelled"
 * (tutor-cancelled attendance also flips it — see `recordAttendanceInFirestore`
 * and the backfill script), so each bucket is a clean equality predicate.
 *
 * Requires composite indexes — see `firestore.indexes.json`.
 */
export async function listLessonsPageFromFirestore(
  userId: string,
  role: string,
  query: LessonPageQuery
): Promise<LessonPageResult> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const status: LessonStatusFilter = query.status ?? "all";

  const limit = Math.max(
    1,
    Math.min(100, Math.floor(query.limit ?? DEFAULT_PAGE_SIZE))
  );

  let q: admin.firestore.Query = firestore.collection("lessons");
  if (role === "tutor") {
    q = q.where("tutorId", "==", userId);
  } else if (role !== "system_admin") {
    throw new Error("Invalid role");
  }

  let dir: "asc" | "desc" = "desc";
  switch (status) {
    case "upcoming":
      q = q.where("isCancelled", "==", false).where("startDateTime", ">=", now);
      dir = "asc";
      break;
    case "past":
      q = q.where("isCancelled", "==", false).where("startDateTime", "<", now);
      break;
    case "cancelled":
      q = q.where("isCancelled", "==", true);
      break;
    case "all":
    default:
      // no bucket filter — include everything
      break;
  }

  // Tiebreak on the document id so identical start times paginate safely.
  q = q
    .orderBy("startDateTime", dir)
    .orderBy(admin.firestore.FieldPath.documentId(), dir);

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    q = q.startAfter(
      admin.firestore.Timestamp.fromDate(new Date(cursor.s)),
      cursor.id
    );
  }

  // Fetch one extra to determine whether another page exists.
  const snapshot = await q.limit(limit + 1).get();
  const docs = snapshot.docs;

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const lessons = pageDocs.map((doc) => mapLesson(doc.id, doc.data()));

  let nextCursor: string | null = null;
  if (hasMore && pageDocs.length > 0) {
    const last = pageDocs[pageDocs.length - 1];
    nextCursor = encodeCursor(mapLesson(last.id, last.data()));
  }

  return { data: lessons, nextCursor, hasMore };
}

/**
 * Get a specific lesson by ID from Firestore
 */
export async function getLessonByIdFromFirestore(
  lessonId: string
): Promise<Lesson | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("lessons").doc(lessonId).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    return mapLesson(doc.id, data);
  } catch (error) {
    console.error("Failed to get lesson from Firestore:", error);
    throw new Error("Failed to get lesson");
  }
}

/**
 * Create lesson document in Firestore
 */
export async function createLessonInFirestore(
  data: CreateLessonRequest,
  tutorId: string
): Promise<Lesson> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const lessonId = generateLessonId();

    const startDateTime = admin.firestore.Timestamp.fromDate(
      new Date(data.startDateTime)
    );

    const lessonData = {
      tutorId,
      studentId: data.studentId,
      subject: data.subject,
      startDateTime,
      durationMinutes: data.durationMinutes,
      location: data.location ?? null,
      meetLink: null,
      notes: data.notes ?? null,
      todos: [],
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      seriesId: null,
      isCancelled: false,
      isException: false,
      remindersEnabled: data.remindersEnabled ?? true,
      lastStudentNotifiedAt: null,
      studentNotifiedCount: 0,
      isPaid: false,
      invoiceId: null,
      googleCalendarEventId: null,
      googleCalendarSyncedAt: null,
      icsUid: null,
      rsvpTokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("lessons").doc(lessonId).set(lessonData);

    return {
      id: lessonId,
      tutorId,
      studentId: data.studentId,
      subject: data.subject,
      startDateTime: startDateTime.toDate() as any,
      durationMinutes: data.durationMinutes,
      location: data.location ?? null,
      meetLink: null,
      notes: data.notes ?? null,
      todos: [],
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      seriesId: null,
      isCancelled: false,
      isException: false,
      remindersEnabled: data.remindersEnabled ?? true,
      lastStudentNotifiedAt: null,
      studentNotifiedCount: 0,
      isPaid: false,
      invoiceId: null,
      googleCalendarEventId: null,
      googleCalendarSyncedAt: null,
      icsUid: null,
      rsvpTokenVersion: 0,
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to create lesson in Firestore:", error);
    throw new Error("Failed to create lesson");
  }
}

/**
 * Update a lesson document in Firestore
 */
export async function updateLessonInFirestore(
  lessonId: string,
  data: UpdateLessonRequest
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    // A direct update marks this occurrence as an exception so later
    // series-level bulk edits skip it.
    const updateData: Record<string, unknown> = { updatedAt: now, isException: true };
    if (data.studentId !== undefined) updateData.studentId = data.studentId;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.startDateTime !== undefined && data.startDateTime !== null) {
      updateData.startDateTime = admin.firestore.Timestamp.fromDate(
        new Date(data.startDateTime)
      );
    }
    if (data.durationMinutes !== undefined)
      updateData.durationMinutes = data.durationMinutes;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.meetLink !== undefined) updateData.meetLink = data.meetLink;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.todos !== undefined) updateData.todos = data.todos;
    if (data.acceptanceStatus !== undefined)
      updateData.acceptanceStatus = data.acceptanceStatus;
    if (data.remindersEnabled !== undefined)
      updateData.remindersEnabled = data.remindersEnabled;
    if (data.isPaid !== undefined) updateData.isPaid = data.isPaid;

    await firestore.collection("lessons").doc(lessonId).update(updateData);
  } catch (error) {
    console.error("Failed to update lesson in Firestore:", error);
    throw new Error("Failed to update lesson");
  }
}

/**
 * Store (or clear) the Google Calendar event id on a lesson, and stamp the
 * sync time. Called after a successful push to Google Calendar. Passing null
 * clears the mapping (e.g. after the event is deleted).
 */
export async function setLessonGoogleEventId(
  lessonId: string,
  googleCalendarEventId: string | null
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("lessons").doc(lessonId).update({
      googleCalendarEventId,
      googleCalendarSyncedAt: googleCalendarEventId
        ? admin.firestore.Timestamp.now()
        : null,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error("Failed to set lesson googleCalendarEventId:", error);
    throw new Error("Failed to record Google Calendar event id");
  }
}

/**
 * Set or clear the invoice association on a lesson. Called by the payment
 * service when a lesson is added to an invoice (set) or when that invoice
 * is voided/deleted (clear). Prevents double-invoicing of the same lesson.
 */
export async function setLessonInvoiceIdInFirestore(
  lessonId: string,
  invoiceId: string | null
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    await firestore.collection("lessons").doc(lessonId).update({
      invoiceId,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Failed to set lesson invoiceId in Firestore:", error);
    throw new Error("Failed to update lesson invoice association");
  }
}

/**
 * Record the attendance/outcome for a lesson.
 *
 * Tutor-cancelled outcomes also flip `isCancelled` to true so that the
 * "cancelled" bucket — which the paginated lessons query filters on with a
 * single equality predicate — includes them. This keeps `isCancelled` as the
 * single source of truth for the cancelled lifecycle state.
 */
export async function recordAttendanceInFirestore(
  lessonId: string,
  attendanceStatus: AttendanceStatus
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const updateData: Record<string, unknown> = {
      attendanceStatus,
      updatedAt: now,
    };
    if (TUTOR_CANCELLED_ATTENDANCE.includes(attendanceStatus)) {
      updateData.isCancelled = true;
    }

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update(updateData);
  } catch (error) {
    console.error("Failed to record attendance in Firestore:", error);
    throw new Error("Failed to record attendance");
  }
}

/**
 * Soft-cancel a single lesson occurrence (forward-looking cancellation).
 * The document is kept for history/audit; derived status treats it as cancelled.
 */
export async function cancelLessonInFirestore(
  lessonId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update({
        isCancelled: true,
        updatedAt: now,
      });
  } catch (error) {
    console.error("Failed to cancel lesson in Firestore:", error);
    throw new Error("Failed to cancel lesson");
  }
}

/**
 * Record that a "Notify Student" email was sent for this lesson.
 * Stamps lastStudentNotifiedAt and increments the running counter.
 * Called only after the email is confirmed delivered.
 */
export async function markStudentNotifiedInFirestore(
  lessonId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update({
        lastStudentNotifiedAt: now,
        studentNotifiedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });
  } catch (error) {
    console.error("Failed to mark student notified in Firestore:", error);
    throw new Error("Failed to record notification");
  }
}

/**
 * List lessons belonging to a recurring series, mapped to Lesson objects
 * (including googleCalendarEventId). Optionally limited to upcoming,
 * non-cancelled occurrences. Used by the calendar sync after series
 * create/update/cancel.
 */
export async function listLessonsBySeriesFromFirestore(
  seriesId: string,
  opts: { futureOnly?: boolean } = {}
): Promise<Lesson[]> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection("lessons")
      .where("seriesId", "==", seriesId)
      .get();

    const nowMs = Date.now();
    const lessons: Lesson[] = [];
    snapshot.forEach((doc) => {
      const lesson = mapLesson(doc.id, doc.data());
      if (opts.futureOnly) {
        if (lesson.isCancelled) return;
        const start = new Date(lesson.startDateTime as any).getTime();
        if (start < nowMs) return;
      }
      lessons.push(lesson);
    });

    lessons.sort(
      (a, b) =>
        new Date(a.startDateTime as any).getTime() -
        new Date(b.startDateTime as any).getTime(),
    );

    return lessons;
  } catch (error) {
    console.error("Failed to list lessons by series:", error);
    throw new Error("Failed to list lessons by series");
  }
}

/**
 * Ensure the lesson has a stable iCalendar UID. Generates and persists one
 * (derived from the lesson id) on first call; subsequent calls reuse it so
 * resends produce updates to the same calendar event rather than duplicates.
 * Returns the UID.
 */
export async function ensureLessonIcsUid(lessonId: string): Promise<string> {
  const icsUid = `${lessonId}@examify-tms`;
  const firestore = getFirebaseFirestore();
  await firestore
    .collection("lessons")
    .doc(lessonId)
    .set({ icsUid }, { merge: true });
  return icsUid;
}

/**
 * Bump the RSVP token version, invalidating Accept/Decline links from all
 * previously-sent emails. Returns the new version (to stamp into the fresh
 * token). Call once per notify-student send.
 */
export async function bumpRsvpTokenVersion(lessonId: string): Promise<number> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const ref = firestore.collection("lessons").doc(lessonId);
  const next = admin.firestore.FieldValue.increment(1);
  await ref.update({ rsvpTokenVersion: next, updatedAt: now });

  const updated = await ref.get();
  return (updated.data()?.rsvpTokenVersion as number) ?? 0;
}

/**
 * Update a lesson's student acceptance status. Used by the public RSVP
 * endpoint when a student clicks Accept/Decline in the invite email.
 * Also re-stamps updatedAt.
 */
export async function setLessonAcceptanceInFirestore(
  lessonId: string,
  acceptanceStatus: LessonAcceptance
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update({
        acceptanceStatus,
        updatedAt: now,
      });
  } catch (error) {
    console.error("Failed to set lesson acceptance in Firestore:", error);
    throw new Error("Failed to update acceptance status");
  }
}
