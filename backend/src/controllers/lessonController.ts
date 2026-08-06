import { Request, Response } from "express";
import {
  createLessonInFirestore,
  listLessonsFromFirestore,
  listLessonsPageFromFirestore,
  LessonPageQuery,
  LessonFilters,
  getLessonByIdFromFirestore,
  updateLessonInFirestore,
  recordAttendanceInFirestore,
  cancelLessonInFirestore,
  markStudentNotifiedInFirestore,
  ensureLessonIcsUid,
  bumpRsvpTokenVersion,
  setLessonAcceptanceInFirestore,
  setLessonGoogleEventId,
  listLessonsBySeriesFromFirestore,
} from "../services/lessonService";
import { getStudentByIdFromFirestore } from "../services/studentService";
import { getUserFromFirestore } from "../services/userService";
import {
  sendLessonNotification,
  sendLessonCancellation,
  sendSeriesRescheduleEmail,
  sendSeriesCancellationEmail,
  buildLessonNotificationContent,
  buildLessonCancellationContent,
  buildSeriesRescheduleContent,
  buildSeriesCancellationContent,
  defaultLessonMessage,
  defaultLessonSubject,
  defaultLessonCancellationMessage,
  defaultLessonCancellationSubject,
  defaultSeriesRescheduleMessage,
  defaultSeriesRescheduleSubject,
  defaultSeriesCancellationMessage,
  defaultSeriesCancellationSubject,
  type LessonNotificationInput,
  type LessonCancellationInput,
} from "../services/emailService";
import { buildLessonInvite, buildLessonCancellation } from "../services/icalService";
import { recordSentEmailSafe } from "../services/sentEmailService";
import {
  syncLessonToCalendar,
  deleteLessonCalendarEvent,
  resyncLessonCalendar,
  GoogleNotConnectedError,
} from "../services/googleCalendarService";
import {
  rescheduleSeriesFromOccurrence,
  deleteSeriesAndFuture,
  getLessonSeriesByIdFromFirestore,
  previewRescheduledSlots,
} from "../services/lessonSeriesService";
import { signRsvpToken, verifyRsvpToken } from "../utils/jwt";
import { getNotifyCooldownMs, getPublicApiUrl } from "../config/email";
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  RescheduleLessonRequest,
  RecordAttendanceRequest,
  CancelLessonRequest,
  NotifyStudentRequest,
  LessonAcceptance,
  Lesson,
  LessonResponse,
  LessonListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewLesson, canEditLesson } from "../permissions/lessonPermissions";
import { resolveTutorNames } from "../services/tutorResolver";

/**
 * Convert a Lesson (Date-typed) to a LessonResponse (ISO string-typed),
 * excluding tutorId.
 */
function toLessonResponse(lesson: Lesson): LessonResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: lesson.id,
    studentId: lesson.studentId,
    subject: lesson.subject ?? null,
    startDateTime: toIso(lesson.startDateTime),
    durationMinutes: lesson.durationMinutes,
    location: lesson.location ?? null,
    meetLink: lesson.meetLink ?? null,
    notes: lesson.notes ?? null,
    todos: lesson.todos ?? [],
    acceptanceStatus: lesson.acceptanceStatus,
    attendanceStatus: lesson.attendanceStatus,
    seriesId: lesson.seriesId ?? null,
    isCancelled: lesson.isCancelled ?? false,
    isException: lesson.isException ?? false,
    remindersEnabled: lesson.remindersEnabled,
    lastStudentNotifiedAt: lesson.lastStudentNotifiedAt
      ? toIso(lesson.lastStudentNotifiedAt)
      : null,
    studentNotifiedCount: lesson.studentNotifiedCount ?? 0,
    isPaid: lesson.isPaid ?? false,
    invoiceId: lesson.invoiceId ?? null,
    googleCalendarEventId: lesson.googleCalendarEventId ?? null,
    googleCalendarSyncedAt: lesson.googleCalendarSyncedAt
      ? toIso(lesson.googleCalendarSyncedAt)
      : null,
    createdAt: toIso(lesson.createdAt),
    updatedAt: toIso(lesson.updatedAt),
  };
}

/**
 * Resolve the display name of the authenticated user for the sent-email log.
 * Best-effort: returns null if the user record can't be loaded.
 */
async function safeGetActorName(uid: string | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    const user = await getUserFromFirestore(uid);
    return user?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Create lesson controller
 */
export async function createLesson(
  req: Request<{}, {}, CreateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await createLessonInFirestore(req.body, req.user.uid);

    // Best-effort push to Google Calendar. Never blocks the response; if it
    // succeeds the returned lesson carries a googleCalendarEventId.
    try {
      await syncLessonToCalendar(req.user.uid, lesson);
    } catch {
      /* syncLessonToCalendar logs internally; ignore here */
    }

    // Re-fetch so the response reflects any persisted googleCalendarEventId.
    const synced = await getLessonByIdFromFirestore(lesson.id);
    res.status(201).json(toLessonResponse(synced ?? lesson));
  } catch (error) {
    console.error("Create lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    res.status(500).json({ message });
  }
}

/**
 * List lessons controller.
 *
 * Two modes share this endpoint:
 *   * Paginated (lessons page): `limit` (+ `status`, `cursor`) — returns one
 *     cursor-paginated page reading only ~limit documents.
 *   * Unpaginated (calendar window / dashboard / invoices): omit `limit` —
 *     returns the full matching set with `nextCursor: null`.
 */
export async function listLessons(
  req: Request,
  res: Response<LessonListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Admins may drill into a single tutor via ?tutorId=…; otherwise they see
    // all lessons. Tutors are always scoped to their own uid.
    const drillTutorId =
      typeof req.query.tutorId === "string" ? req.query.tutorId : null;
    const scopeUid =
      req.user.role === "system_admin" && drillTutorId
        ? drillTutorId
        : req.user.uid;
    const scopeRole =
      req.user.role === "system_admin" && drillTutorId
        ? "tutor"
        : req.user.role;

    // Cursor pagination (lessons page).
    const hasLimit =
      req.query.limit != null && req.query.limit !== "" &&
      Number.isFinite(Number(req.query.limit)) && Number(req.query.limit) > 0;

    if (hasLimit) {
      const query: LessonPageQuery = { limit: Math.min(100, Math.floor(Number(req.query.limit))) };
      if (typeof req.query.status === "string") {
        query.status = req.query.status as LessonPageQuery["status"];
      }
      if (typeof req.query.cursor === "string" && req.query.cursor) {
        query.cursor = req.query.cursor;
      }
      const result = await listLessonsPageFromFirestore(
        scopeUid,
        scopeRole,
        query
      );
      let data = result.data.map(toLessonResponse);
      if (req.user.role === "system_admin") {
        const names = await resolveTutorNames(
          result.data.map((l) => l.tutorId),
        );
        data = data.map((r, i) => {
          const info = names.get(result.data[i].tutorId);
          return {
            ...r,
            tutorId: result.data[i].tutorId,
            tutorName: info?.name ?? null,
            tutorEmail: info?.email ?? null,
          };
        });
      }
      res.status(200).json({
        data,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
      return;
    }

    // Full fetch (calendar window / dashboard / invoices).
    const filters: LessonFilters = {};
    if (typeof req.query.from === "string") {
      filters.from = new Date(req.query.from);
    }
    if (typeof req.query.to === "string") {
      filters.to = new Date(req.query.to);
    }
    if (typeof req.query.studentId === "string") {
      filters.studentId = req.query.studentId;
    }
    if (typeof req.query.seriesId === "string") {
      filters.seriesId = req.query.seriesId;
    }
    if (typeof req.query.acceptanceStatus === "string") {
      filters.acceptanceStatus = req.query.acceptanceStatus;
    }
    if (typeof req.query.attendanceStatus === "string") {
      filters.attendanceStatus = req.query.attendanceStatus;
    }
    if (req.query.unpaid === "true" || req.query.unpaid === "1") {
      filters.unpaid = true;
    }

    const lessons = await listLessonsFromFirestore(
      scopeUid,
      scopeRole,
      filters
    );

    let data = lessons.map(toLessonResponse);
    if (req.user.role === "system_admin") {
      const names = await resolveTutorNames(lessons.map((l) => l.tutorId));
      data = data.map((r, i) => {
        const info = names.get(lessons[i].tutorId);
        return {
          ...r,
          tutorId: lessons[i].tutorId,
          tutorName: info?.name ?? null,
          tutorEmail: info?.email ?? null,
        };
      });
    }

    res.status(200).json({
      data,
      nextCursor: null,
      hasMore: false,
    });
  } catch (error) {
    console.error("List lessons failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list lessons";
    // A bad cursor is a client error.
    if (message === "Invalid cursor") {
      res.status(400).json({ message });
      return;
    }
    res.status(500).json({ message });
  }
}

/**
 * Get lesson by ID controller
 */
export async function getLessonById(
  req: Request<{ id: string }>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canViewLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to view this lesson" });
      return;
    }

    res.status(200).json(toLessonResponse(lesson));
  } catch (error) {
    console.error("Get lesson by ID failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get lesson";
    res.status(500).json({ message });
  }
}

/**
 * Update lesson controller
 */
export async function updateLesson(
  req: Request<{ id: string }, {}, UpdateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await updateLessonInFirestore(req.params.id, req.body);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    // Best-effort re-sync to Google Calendar (creates the event if missing
    // while connected, otherwise patches the existing one).
    try {
      await syncLessonToCalendar(req.user.uid, updated);
    } catch {
      /* logged inside syncLessonToCalendar */
    }

    const resynced = (await getLessonByIdFromFirestore(req.params.id)) ?? updated;
    res.status(200).json(toLessonResponse(resynced));
  } catch (error) {
    console.error("Update lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    res.status(500).json({ message });
  }
}

/**
 * Reschedule a single lesson occurrence to a new time.
 *
 * Unlike the generic PATCH /api/lessons/:id (a "silent" edit), a reschedule
 * can also re-notify the student: it resets acceptance to `pending`, bumps
 * the iCal SEQUENCE (so the student's calendar entry updates in place rather
 * than duplicating), invalidates prior RSVP links, and sends a fresh invite.
 * The time change itself reuses the standard update path, so Google Calendar
 * re-syncs and a recurring occurrence is marked as an exception.
 */
export async function rescheduleLesson(
  req: Request<{ id: string }, {}, RescheduleLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to reschedule this lesson" });
      return;
    }

    // Only active, not-yet-taught lessons can be moved. Cancelled or
    // attended lessons can't be rescheduled — create a new lesson instead.
    if (lesson.isCancelled) {
      res
        .status(400)
        .json({ message: "Cannot reschedule a cancelled lesson. Create a new lesson instead." });
      return;
    }
    if (lesson.attendanceStatus !== "unrecorded") {
      res.status(400).json({
        message:
          "Cannot reschedule a lesson that has already been recorded. Create a new lesson instead.",
      });
      return;
    }

    const { startDateTime, durationMinutes, message } = req.body;
    // notifyStudent defaults to true unless explicitly disabled.
    const shouldNotify = req.body?.notifyStudent !== false;

    if (!startDateTime) {
      res.status(400).json({ message: "startDateTime is required" });
      return;
    }
    const newStart = new Date(startDateTime);
    if (Number.isNaN(newStart.getTime())) {
      res.status(400).json({ message: "Invalid startDateTime" });
      return;
    }

    // --- Series scope: update the slot + regenerate all future occurrences ---
    if (req.body?.scope === "this_and_future") {
      if (!lesson.seriesId) {
        res.status(400).json({ message: "This lesson is not part of a series." });
        return;
      }

      const oldStart = new Date(lesson.startDateTime as any);
      const { removed, created } = await rescheduleSeriesFromOccurrence(
        lesson.seriesId,
        oldStart,
        newStart,
        durationMinutes ?? null,
      );

      // Best-effort calendar cleanup + sync.
      try {
        await Promise.all(
          removed
            .filter((l) => l.googleCalendarEventId)
            .map((l) => deleteLessonCalendarEvent(req.user!.uid, l.googleCalendarEventId)),
        );
      } catch { /* logged inside */ }
      try {
        await Promise.all(created.map((l) => syncLessonToCalendar(req.user!.uid, l)));
      } catch { /* logged inside */ }

      // Best-effort: one summary email to the student.
      if (shouldNotify) {
        try {
          const [student, tutor, series] = await Promise.all([
            getStudentByIdFromFirestore(lesson.studentId),
            getUserFromFirestore(lesson.tutorId),
            getLessonSeriesByIdFromFirestore(lesson.seriesId),
          ]);
          if (student?.email && series) {
            const firstUpcoming = created.length > 0
              ? created.reduce((min, l) =>
                  new Date(l.startDateTime as any) < new Date(min.startDateTime as any) ? l : min)
              : null;
            const content = await sendSeriesRescheduleEmail({
              to: student.email,
              studentName: student.name,
              tutorName: tutor.name,
              tutorEmail: tutor.email,
              subject: lesson.subject ?? null,
              timezone: tutor.timezone ?? null,
              slots: series.slots,
              intervalWeeks: series.intervalWeeks,
              firstUpcoming: firstUpcoming ? new Date(firstUpcoming.startDateTime as any) : null,
              message,
            });
            await recordSentEmailSafe({
              type: "lesson_notify",
              to: student.email,
              subject: content.subject,
              status: "sent",
              bodyHtml: content.html,
              tutorId: lesson.tutorId,
              studentId: lesson.studentId,
              sentBy: req.user.uid,
              sentByName: await safeGetActorName(req.user.uid),
            });
          }
        } catch (notifyError) {
          console.error("Series reschedule notify failed:", notifyError);
        }
      }

      const responseLesson = created.length > 0
        ? created.reduce((min, l) =>
            new Date(l.startDateTime as any) < new Date(min.startDateTime as any) ? l : min)
        : lesson;
      res.status(200).json(toLessonResponse(responseLesson));
      return;
    }

    // Apply the time change via the standard update path. This also marks a
    // recurring occurrence as an exception and re-stamps updatedAt.
    const update: UpdateLessonRequest = { startDateTime };
    if (durationMinutes != null) update.durationMinutes = durationMinutes;
    await updateLessonInFirestore(req.params.id, update);

    // Reset the student's acceptance: their prior response was for the old slot.
    if (shouldNotify) {
      await setLessonAcceptanceInFirestore(req.params.id, "pending");
    }

    // Re-fetch with the new time so the Google sync + invite use it.
    let updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    // Best-effort Google Calendar re-sync (patches the existing event's time).
    try {
      await syncLessonToCalendar(req.user.uid, updated);
    } catch {
      /* logged inside syncLessonToCalendar */
    }

    // Best-effort student re-notify. The reschedule itself always succeeds
    // even if the email can't go out (e.g. SMTP unconfigured / no email).
    if (shouldNotify) {
      updated = (await getLessonByIdFromFirestore(req.params.id)) ?? updated;
      try {
        await dispatchLessonNotification(updated, {
          message,
          bypassCooldown: true,
          reason: "reschedule",
          actorUid: req.user.uid,
          actorName: await safeGetActorName(req.user.uid),
        });
      } catch (notifyError) {
        console.error("Reschedule notify failed:", notifyError);
      }
    }

    const finalLesson = (await getLessonByIdFromFirestore(req.params.id)) ?? updated;
    res.status(200).json(toLessonResponse(finalLesson));
  } catch (error) {
    console.error("Reschedule lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to reschedule lesson";
    res.status(500).json({ message });
  }
}

/**
 * Resync a single lesson to Google Calendar. Recreates the backing Google
 * event if it was deleted over on Google's side. Intended for the per-lesson
 * "Resync" button. Returns the updated lesson + the action taken.
 */
export async function resyncLesson(
  req: Request<{ id: string }>,
  res: Response<
    { lesson: LessonResponse; action: "created" | "updated" | "recreated" } | ApiError
  >,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to resync this lesson" });
      return;
    }

    const { action } = await resyncLessonCalendar(req.user.uid, lesson);

    const updated = (await getLessonByIdFromFirestore(req.params.id)) ?? lesson;
    res.status(200).json({ lesson: toLessonResponse(updated), action });
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res.status(400).json({ message: "Connect your Google account first." });
      return;
    }
    console.error("Resync lesson failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to resync lesson";
    res.status(500).json({ message });
  }
}

/**
 * Record attendance controller
 */
export async function recordAttendance(
  req: Request<{ id: string }, {}, RecordAttendanceRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await recordAttendanceInFirestore(req.params.id, req.body.attendanceStatus);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Record attendance failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to record attendance";
    res.status(500).json({ message });
  }
}

/**
 * Cancel a single lesson occurrence (soft cancel). Optionally notifies the
 * student — typically offered by the UI when the student had already accepted
 * the lesson — sending a cancellation email and, if they were previously sent
 * an invite, a METHOD:CANCEL calendar update.
 */
export async function cancelLesson(
  req: Request<{ id: string }, {}, CancelLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to cancel this lesson" });
      return;
    }

    // Prevent cancellation of finished lessons
    const now = new Date();
    const endTime = new Date(new Date(lesson.startDateTime as any).getTime() + lesson.durationMinutes * 60_000);
    const isFinished = lesson.attendanceStatus !== "unrecorded" || endTime < now;
    
    if (isFinished) {
      res.status(400).json({ 
        message: "Cannot cancel finished lessons. Only upcoming lessons with unrecorded attendance can be cancelled." 
      });
      return;
    }

    // --- Series scope: delete the series + all future occurrences ---
    if (req.body?.scope === "this_and_future") {
      if (!lesson.seriesId) {
        res.status(400).json({ message: "This lesson is not part of a series." });
        return;
      }

      const removed = await deleteSeriesAndFuture(lesson.seriesId);

      // Best-effort calendar cleanup.
      try {
        await Promise.all(
          removed
            .filter((l) => l.googleCalendarEventId)
            .map((l) => deleteLessonCalendarEvent(req.user!.uid, l.googleCalendarEventId)),
        );
      } catch { /* logged inside */ }

      // Best-effort: one summary email to the student.
      if (req.body?.notifyStudent === true) {
        try {
          const [student, tutor] = await Promise.all([
            getStudentByIdFromFirestore(lesson.studentId),
            getUserFromFirestore(lesson.tutorId),
          ]);
          if (student?.email) {
            const removedDates = removed.map((l) => new Date(l.startDateTime as any));
            const content = await sendSeriesCancellationEmail({
              to: student.email,
              studentName: student.name,
              tutorName: tutor.name,
              tutorEmail: tutor.email,
              subject: lesson.subject ?? null,
              timezone: tutor.timezone ?? null,
              removedDates,
              message: req.body?.message,
            });
            await recordSentEmailSafe({
              type: "lesson_cancel",
              to: student.email,
              subject: content.subject,
              status: "sent",
              bodyHtml: content.html,
              tutorId: lesson.tutorId,
              studentId: lesson.studentId,
              sentBy: req.user.uid,
              sentByName: await safeGetActorName(req.user.uid),
            });
          }
        } catch (notifyError) {
          console.error("Series cancel notify failed:", notifyError);
        }
      }

      res.status(200).json(toLessonResponse(lesson));
      return;
    }

    await cancelLessonInFirestore(req.params.id);

    // Best-effort delete the corresponding Google Calendar event.
    try {
      await deleteLessonCalendarEvent(req.user.uid, lesson.googleCalendarEventId);
      if (lesson.googleCalendarEventId) {
        await setLessonGoogleEventId(req.params.id, null);
      }
    } catch {
      /* logged inside deleteLessonCalendarEvent */
    }

    // Optional student cancellation notification. Best-effort: the cancel
    // itself always succeeds even if the email can't go out.
    if (req.body?.notifyStudent === true) {
      const cancelled = await getLessonByIdFromFirestore(req.params.id);
      if (cancelled) {
        try {
          await dispatchLessonCancellation(cancelled, {
            message: req.body?.message,
            actorUid: req.user.uid,
            actorName: await safeGetActorName(req.user.uid),
          });
        } catch (notifyError) {
          console.error("Cancel notify failed:", notifyError);
        }
      }
    }

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Cancel lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel lesson";
    res.status(500).json({ message });
  }
}

/**
 * Thrown by {@link dispatchLessonNotification} when the notify cooldown has
 * not yet elapsed. Carries the ISO time at which the next send is allowed.
 */
class NotifyCooldownError extends Error {
  constructor(public nextAllowedAt: string) {
    super("notify-cooldown");
    this.name = "NotifyCooldownError";
  }
}

/**
 * Thrown by {@link dispatchLessonNotification} when the linked student has no
 * email address to send to.
 */
class StudentEmailMissingError extends Error {
  constructor() {
    super("student-email-missing");
    this.name = "StudentEmailMissingError";
  }
}

/**
 * Shared core of the notify-student flow, used by both the standalone "Notify
 * student" endpoint and the reschedule endpoint.
 *
 * Resolves the student + tutor, ensures a stable iCal UID, bumps the RSVP
 * token version (invalidating Accept/Decline links from every previously-sent
 * email), builds the calendar invite, and sends the email. On success the
 * lesson is stamped as notified.
 *
 * `reason` selects the default greeting used when no explicit `message` is
 * supplied (a reschedule reads differently from a plain reminder). Throws
 * {@link NotifyCooldownError} / {@link StudentEmailMissingError} for the
 * caller to map to an HTTP status.
 */
async function dispatchLessonNotification(
  lesson: Lesson,
  opts: {
    message?: string | null;
    bypassCooldown?: boolean;
    reason?: "reminder" | "reschedule";
    /** UID of the user triggering the send, for the sent-email log. */
    actorUid: string;
    /** Display name of the user triggering the send, if resolvable. */
    actorName?: string | null;
  },
): Promise<void> {
  if (!opts.bypassCooldown && lesson.lastStudentNotifiedAt) {
    const cooldownMs = getNotifyCooldownMs();
    const elapsed =
      Date.now() - new Date(lesson.lastStudentNotifiedAt as any).getTime();
    if (elapsed < cooldownMs) {
      const nextAllowedAt = new Date(
        new Date(lesson.lastStudentNotifiedAt as any).getTime() + cooldownMs,
      ).toISOString();
      throw new NotifyCooldownError(nextAllowedAt);
    }
  }

  const student = await getStudentByIdFromFirestore(lesson.studentId);
  if (!student || !student.email) {
    throw new StudentEmailMissingError();
  }

  const tutor = await getUserFromFirestore(lesson.tutorId);

  // Stamp a stable iCal UID (reused across sends so calendar clients see
  // updates, not duplicates) and bump the RSVP token version, which
  // invalidates the Accept/Decline links from every previously-sent email.
  const icsUid = await ensureLessonIcsUid(lesson.id);
  const sequence = await bumpRsvpTokenVersion(lesson.id);

  const start = new Date(lesson.startDateTime as any);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

  const rsvpToken = signRsvpToken(lesson.id, sequence);
  const rsvpBase = `${getPublicApiUrl()}/api/lessons/rsvp`;
  const rsvpLinks = {
    accept: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=accepted`,
    decline: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=declined`,
  };

  const icsContent = buildLessonInvite({
    icsUid,
    // SEQUENCE mirrors the bumped RSVP version: each send is an update.
    sequence,
    summary: `${lesson.subject ?? "Lesson"} with ${tutor.name}`,
    start,
    end,
    timezone: tutor.timezone ?? null,
    // ICS location uses the actual Meet URL (if any) so calendar clients
    // render a clickable join link, not just the display label.
    location: lesson.meetLink ?? lesson.location,
    organizer: { name: tutor.name, email: tutor.email },
    attendee: { name: student.name, email: student.email },
  });

  // An explicit message always wins; otherwise a null message lets the email
  // service render its own reason-aware greeting (reminder / reschedule) from
  // the template store.
  const message =
    opts.message && opts.message.trim().length > 0 ? opts.message.trim() : null;

  try {
    const content = await sendLessonNotification({
      to: student.email,
      studentName: student.name,
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      subject: lesson.subject ?? null,
      startDateTime: start,
      durationMinutes: lesson.durationMinutes,
      location: lesson.location,
      timezone: tutor.timezone ?? null,
      message,
      icsContent,
      rsvpLinks,
      reason: opts.reason,
    });

    await recordSentEmailSafe({
      type: "lesson_notify",
      to: student.email,
      subject: content.subject,
      status: "sent",
      bodyHtml: content.html,
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      studentId: lesson.studentId,
      sentBy: opts.actorUid,
      sentByName: opts.actorName ?? null,
    });
  } catch (sendError) {
    // Record the failed attempt so the history shows why nothing arrived,
    // then re-throw so the caller can map it to an HTTP status.
    await recordSentEmailSafe({
      type: "lesson_notify",
      to: student.email,
      subject: "",
      status: "failed",
      errorMessage:
        sendError instanceof Error ? sendError.message : String(sendError),
      bodyHtml: "",
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      studentId: lesson.studentId,
      sentBy: opts.actorUid,
      sentByName: opts.actorName ?? null,
    });
    throw sendError;
  }

  await markStudentNotifiedInFirestore(lesson.id);
}

/**
 * Send a cancellation email to the student linked to the lesson. Used by the
 * cancel endpoint when the tutor opts to notify. When the student was
 * previously sent an invite (has an `icsUid`), a METHOD:CANCEL calendar update
 * is attached so the event is removed from their calendar; the RSVP version is
 * bumped to give it a SEQUENCE higher than the last REQUEST. Best-effort
 * callers should catch the thrown {@link StudentEmailMissingError} / generic
 * errors.
 */
async function dispatchLessonCancellation(
  lesson: Lesson,
  opts: {
    message?: string | null;
    /** UID of the user triggering the send, for the sent-email log. */
    actorUid: string;
    /** Display name of the user triggering the send, if resolvable. */
    actorName?: string | null;
  },
): Promise<void> {
  const student = await getStudentByIdFromFirestore(lesson.studentId);
  if (!student || !student.email) {
    throw new StudentEmailMissingError();
  }

  const tutor = await getUserFromFirestore(lesson.tutorId);

  const start = new Date(lesson.startDateTime as any);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

  // Only attach a CANCEL iCal if the student was ever sent an invite —
  // otherwise there's no calendar entry to remove. Bumping the RSVP version
  // yields a SEQUENCE higher than the last REQUEST send.
  let icsContent: string | undefined;
  if (lesson.icsUid) {
    const sequence = await bumpRsvpTokenVersion(lesson.id);
    icsContent = buildLessonCancellation({
      icsUid: lesson.icsUid,
      sequence,
      summary: `${lesson.subject ?? "Lesson"} with ${tutor.name}`,
      start,
      end,
      timezone: tutor.timezone ?? null,
      location: lesson.meetLink ?? lesson.location,
      organizer: { name: tutor.name, email: tutor.email },
      attendee: { name: student.name, email: student.email },
    });
  }

  try {
    const content = await sendLessonCancellation({
      to: student.email,
      studentName: student.name,
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      subject: lesson.subject ?? null,
      startDateTime: start,
      durationMinutes: lesson.durationMinutes,
      location: lesson.location,
      timezone: tutor.timezone ?? null,
      message: opts.message,
      icsContent,
    });

    await recordSentEmailSafe({
      type: "lesson_cancel",
      to: student.email,
      subject: content.subject,
      status: "sent",
      bodyHtml: content.html,
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      studentId: lesson.studentId,
      sentBy: opts.actorUid,
      sentByName: opts.actorName ?? null,
    });
  } catch (sendError) {
    await recordSentEmailSafe({
      type: "lesson_cancel",
      to: student.email,
      subject: "",
      status: "failed",
      errorMessage:
        sendError instanceof Error ? sendError.message : String(sendError),
      bodyHtml: "",
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      studentId: lesson.studentId,
      sentBy: opts.actorUid,
      sentByName: opts.actorName ?? null,
    });
    throw sendError;
  }
}

/**
 * Notify student controller
 *
 * Sends a reminder email to the student linked to the lesson. Enforces a
 * cooldown (default 24h) so the student can't be spammed or notified twice
 * by accident. The lesson document is stamped with the send timestamp only
 * after the email is confirmed delivered.
 */
export async function notifyStudent(
  req: Request<{ id: string }, {}, NotifyStudentRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to notify for this lesson" });
      return;
    }

    try {
      await dispatchLessonNotification(lesson, {
        message: req.body?.message,
        bypassCooldown: false,
        reason: "reminder",
        actorUid: req.user.uid,
        actorName: await safeGetActorName(req.user.uid),
      });
    } catch (e) {
      if (e instanceof NotifyCooldownError) {
        res.status(409).json({
          message: `This student was already notified. You can send another reminder after ${e.nextAllowedAt}.`,
        });
        return;
      }
      if (e instanceof StudentEmailMissingError) {
        res.status(400).json({ message: "This student has no email address on file" });
        return;
      }
      throw e;
    }

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Notify student failed:", error);
    const message = error instanceof Error ? error.message : "Failed to notify student";
    res.status(500).json({ message });
  }
}

/**
 * Shape returned by every email preview endpoint: the rendered email
 * (honouring any supplied message) plus the untouched defaults so the compose
 * dialog can prefill / reset its fields.
 */
interface EmailPreviewResponse {
  to: string[];
  subject: string;
  text: string;
  html: string;
  defaultSubject: string;
  defaultMessage: string;
}

/**
 * Resolve the data needed to render a lesson-notification email for PREVIEW,
 * with no side effects: it reads the existing iCal UID + RSVP version instead
 * of creating/bumping them (the real send does). Supports an optional proposed
 * start/duration so the reschedule preview can render the NEW time before the
 * lesson is actually moved.
 */
async function resolveNotifyPreviewInput(
  lesson: Lesson,
  opts: {
    message?: string | null;
    reason?: "reminder" | "reschedule";
    startDateTime?: Date;
    durationMinutes?: number;
  },
): Promise<{
  input: LessonNotificationInput;
  defaultSubject: string;
  defaultMessage: string;
}> {
  const student = await getStudentByIdFromFirestore(lesson.studentId);
  if (!student || !student.email) {
    throw new StudentEmailMissingError();
  }
  const tutor = await getUserFromFirestore(lesson.tutorId);

  const start = opts.startDateTime ?? new Date(lesson.startDateTime as any);
  const duration = opts.durationMinutes ?? lesson.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);

  // Read-only equivalents of ensureLessonIcsUid / bumpRsvpTokenVersion so the
  // preview never mutates the lesson. The real send persists + bumps these.
  const icsUid = lesson.icsUid ?? `${lesson.id}@examify-tms`;
  const sequence = lesson.rsvpTokenVersion ?? 0;

  const rsvpToken = signRsvpToken(lesson.id, sequence);
  const rsvpBase = `${getPublicApiUrl()}/api/lessons/rsvp`;
  const rsvpLinks = {
    accept: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=accepted`,
    decline: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=declined`,
  };

  const icsContent = buildLessonInvite({
    icsUid,
    sequence,
    summary: `${lesson.subject ?? "Lesson"} with ${tutor.name}`,
    start,
    end,
    timezone: tutor.timezone ?? null,
    location: lesson.meetLink ?? lesson.location,
    organizer: { name: tutor.name, email: tutor.email },
    attendee: { name: student.name, email: student.email },
  });

  const reason = opts.reason ?? "reminder";
  const input: LessonNotificationInput = {
    to: student.email,
    studentName: student.name,
    tutorName: tutor.name,
    tutorEmail: tutor.email,
    subject: lesson.subject ?? null,
    startDateTime: start,
    durationMinutes: duration,
    location: lesson.location,
    timezone: tutor.timezone ?? null,
    message: opts.message,
    icsContent,
    rsvpLinks,
    reason,
  };

  return {
    input,
    defaultSubject: defaultLessonSubject(input),
    defaultMessage: defaultLessonMessage(student.name, reason),
  };
}

/**
 * Preview the lesson reminder/notify email without sending. Renders the full
 * email (subject + body + calendar invite + RSVP buttons) using read-only
 * state, honouring an optional edited message/subject. Used by the compose
 * dialog so the tutor can review and edit before sending.
 */
export async function previewNotifyStudent(
  req: Request<{ id: string }, {}, { message?: string }>,
  res: Response<EmailPreviewResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }
    if (!canEditLesson(lesson, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    let resolved;
    try {
      resolved = await resolveNotifyPreviewInput(lesson, {
        message: req.body?.message,
        reason: "reminder",
      });
    } catch (e) {
      if (e instanceof StudentEmailMissingError) {
        res.status(400).json({ message: "This student has no email address on file" });
        return;
      }
      throw e;
    }

    const content = buildLessonNotificationContent(resolved.input);
    res.status(200).json({
      to: [resolved.input.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
      defaultSubject: resolved.defaultSubject,
      defaultMessage: resolved.defaultMessage,
    });
  } catch (error) {
    console.error("Preview notify student failed:", error);
    const message = error instanceof Error ? error.message : "Failed to preview email";
    res.status(500).json({ message });
  }
}

/**
 * Preview the email that would be sent on a reschedule, WITHOUT moving the
 * lesson. Renders either the single-occurrence update invite (using the
 * proposed new time) or — when scope is "this_and_future" — the series
 * schedule-summary email, with the new slot derived read-only.
 */
export async function previewRescheduleLesson(
  req: Request<
    { id: string },
    {},
    {
      startDateTime?: string;
      durationMinutes?: number;
      scope?: "this" | "this_and_future";
      message?: string;
    }
  >,
  res: Response<EmailPreviewResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }
    if (!canEditLesson(lesson, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const newStart = req.body?.startDateTime
      ? new Date(req.body.startDateTime)
      : new Date(lesson.startDateTime as any);
    if (Number.isNaN(newStart.getTime())) {
      res.status(400).json({ message: "Invalid startDateTime" });
      return;
    }
    const duration = req.body?.durationMinutes ?? lesson.durationMinutes;

    // Series scope: preview the schedule-summary email with derived new slots.
    if (req.body?.scope === "this_and_future") {
      if (!lesson.seriesId) {
        res.status(400).json({ message: "This lesson is not part of a series." });
        return;
      }
      const [student, tutor, series] = await Promise.all([
        getStudentByIdFromFirestore(lesson.studentId),
        getUserFromFirestore(lesson.tutorId),
        getLessonSeriesByIdFromFirestore(lesson.seriesId),
      ]);
      if (!student?.email) {
        res.status(400).json({ message: "This student has no email address on file" });
        return;
      }
      if (!series || !tutor) {
        res.status(404).json({ message: "Series not found" });
        return;
      }
      const tz = series.timezone ?? tutor.timezone ?? null;
      const slots = previewRescheduledSlots(
        series.slots,
        new Date(lesson.startDateTime as any),
        newStart,
        tz ?? "Etc/UTC",
      );
      const input = {
        to: student.email,
        studentName: student.name,
        tutorName: tutor.name,
        tutorEmail: tutor.email,
        subject: lesson.subject ?? null,
        timezone: tz,
        slots,
        intervalWeeks: series.intervalWeeks,
        firstUpcoming: newStart,
        message: req.body?.message,
      };
      const content = buildSeriesRescheduleContent(input);
      res.status(200).json({
        to: [student.email],
        subject: content.subject,
        text: content.text,
        html: content.html,
        defaultSubject: defaultSeriesRescheduleSubject(input),
        defaultMessage: defaultSeriesRescheduleMessage(student.name, lesson.subject ?? null),
      });
      return;
    }

    // Single occurrence: preview the updated invite with the proposed time.
    let resolved;
    try {
      resolved = await resolveNotifyPreviewInput(lesson, {
        message: req.body?.message,
        reason: "reschedule",
        startDateTime: newStart,
        durationMinutes: duration,
      });
    } catch (e) {
      if (e instanceof StudentEmailMissingError) {
        res.status(400).json({ message: "This student has no email address on file" });
        return;
      }
      throw e;
    }
    const content = buildLessonNotificationContent(resolved.input);
    res.status(200).json({
      to: [resolved.input.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
      defaultSubject: resolved.defaultSubject,
      defaultMessage: resolved.defaultMessage,
    });
  } catch (error) {
    console.error("Preview reschedule email failed:", error);
    const message = error instanceof Error ? error.message : "Failed to preview email";
    res.status(500).json({ message });
  }
}

/**
 * Preview the cancellation email without cancelling. Renders either the
 * single-lesson cancellation (with an optional CANCEL calendar update when
 * the student was previously invited) or — when scope is
 * "this_and_future" — the series-cancellation summary listing the upcoming
 * lessons that would be removed (read from the series, no mutation).
 */
export async function previewCancelLesson(
  req: Request<
    { id: string },
    {},
    {
      scope?: "this" | "this_and_future";
      message?: string;
    }
  >,
  res: Response<EmailPreviewResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }
    if (!canEditLesson(lesson, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Series scope: preview the cancellation summary listing removed dates.
    if (req.body?.scope === "this_and_future") {
      if (!lesson.seriesId) {
        res.status(400).json({ message: "This lesson is not part of a series." });
        return;
      }
      const [student, tutor, upcoming] = await Promise.all([
        getStudentByIdFromFirestore(lesson.studentId),
        getUserFromFirestore(lesson.tutorId),
        listLessonsBySeriesFromFirestore(lesson.seriesId, { futureOnly: true }),
      ]);
      if (!student?.email) {
        res.status(400).json({ message: "This student has no email address on file" });
        return;
      }
      if (!tutor) {
        res.status(404).json({ message: "Tutor not found" });
        return;
      }
      const removedDates = upcoming.map((l) => new Date(l.startDateTime as any));
      const input = {
        to: student.email,
        studentName: student.name,
        tutorName: tutor.name,
        tutorEmail: tutor.email,
        subject: lesson.subject ?? null,
        timezone: tutor.timezone ?? null,
        removedDates,
        message: req.body?.message,
      };
      const content = buildSeriesCancellationContent(input);
      res.status(200).json({
        to: [student.email],
        subject: content.subject,
        text: content.text,
        html: content.html,
        defaultSubject: defaultSeriesCancellationSubject(input),
        defaultMessage: defaultSeriesCancellationMessage(
          student.name,
          lesson.subject ?? null,
          removedDates.length,
        ),
      });
      return;
    }

    // Single lesson cancellation preview.
    const student = await getStudentByIdFromFirestore(lesson.studentId);
    if (!student?.email) {
      res.status(400).json({ message: "This student has no email address on file" });
      return;
    }
    const tutor = await getUserFromFirestore(lesson.tutorId);

    const start = new Date(lesson.startDateTime as any);
    const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

    // Attach a CANCEL iCal only if the student was ever sent an invite.
    let icsContent: string | undefined;
    if (lesson.icsUid) {
      icsContent = buildLessonCancellation({
        icsUid: lesson.icsUid,
        sequence: lesson.rsvpTokenVersion ?? 0,
        summary: `${lesson.subject ?? "Lesson"} with ${tutor.name}`,
        start,
        end,
        timezone: tutor.timezone ?? null,
        location: lesson.meetLink ?? lesson.location,
        organizer: { name: tutor.name, email: tutor.email },
        attendee: { name: student.name, email: student.email },
      });
    }

    const input: LessonCancellationInput = {
      to: student.email,
      studentName: student.name,
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      subject: lesson.subject ?? null,
      startDateTime: start,
      durationMinutes: lesson.durationMinutes,
      location: lesson.location,
      timezone: tutor.timezone ?? null,
      message: req.body?.message,
      icsContent,
    };
    const content = buildLessonCancellationContent(input);
    res.status(200).json({
      to: [student.email],
      subject: content.subject,
      text: content.text,
      html: content.html,
      defaultSubject: defaultLessonCancellationSubject(input),
      defaultMessage: defaultLessonCancellationMessage(student.name),
    });
  } catch (error) {
    console.error("Preview cancel email failed:", error);
    const message = error instanceof Error ? error.message : "Failed to preview email";
    res.status(500).json({ message });
  }
}

/**
 * Public RSVP endpoint — reached when a student clicks Accept/Decline in the
 * invite email. No auth (students aren't users); the signed `token` carries
 * the lesson id + the RSVP version it was issued for. We reject if the token
 * is invalid, expired, or its version no longer matches the lesson (a resend
 * supersedes older links).
 *
 * Responds with a small confirmation HTML page rather than JSON, since the
 * link is opened in a browser from an email client.
 */
export async function rsvpLesson(
  req: Request,
  res: Response
): Promise<void> {
  const status = String(req.query.status ?? "").toLowerCase();
  const desired: LessonAcceptance | null =
    status === "accepted" ? "accepted" : status === "declined" ? "declined" : null;

  const payload = verifyRsvpToken(req.query.token as string | undefined);

  if (!payload || !desired) {
    res
      .status(400)
      .type("html")
      .send(renderRsvpPage("invalid", null));
    return;
  }

  try {
    const lesson = await getLessonByIdFromFirestore(payload.lessonId);
    if (!lesson) {
      res.status(404).type("html").send(renderRsvpPage("invalid", null));
      return;
    }

    // A resend bumps rsvpTokenVersion; older links must no longer work.
    if ((lesson.rsvpTokenVersion ?? 0) !== payload.version) {
      res.status(409).type("html").send(renderRsvpPage("superseded", null));
      return;
    }

    await setLessonAcceptanceInFirestore(payload.lessonId, desired);
    res.status(200).type("html").send(renderRsvpPage(desired, lesson));
  } catch (error) {
    console.error("RSVP failed:", error);
    res.status(500).type("html").send(renderRsvpPage("invalid", null));
  }
}

/**
 * Render the confirmation page returned after an RSVP click.
 * `outcome` is "accepted" | "declined" on success, or an error sentinel.
 */
function renderRsvpPage(
  outcome: "accepted" | "declined" | "invalid" | "superseded",
  lesson: Lesson | null
): string {
  const when = lesson
    ? new Date(lesson.startDateTime as any).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const copy: Record<typeof outcome, { title: string; body: string }> = {
    accepted: {
      title: "You're confirmed ✓",
      body: lesson
        ? `Thanks! We've let your tutor know you'll be at <strong>${escapeHtmlText(
            lesson.subject ?? "Lesson"
          )}</strong> on <strong>${escapeHtmlText(when!)}</strong>.`
        : "Thanks! Your tutor has been notified that you've accepted.",
    },
    declined: {
      title: "Marked as declined",
      body: lesson
        ? `We've let your tutor know you can't make <strong>${escapeHtmlText(
            lesson.subject ?? "Lesson"
          )}</strong> on <strong>${escapeHtmlText(when!)}</strong>.`
        : "We've let your tutor know you can't make this lesson.",
    },
    invalid: {
      title: "This link isn't valid",
      body: "The response link may have expired or already been used. Please contact your tutor to confirm.",
    },
    superseded: {
      title: "This link has been replaced",
      body: "A newer reminder was sent for this lesson — please use the Accept/Decline buttons in the most recent email.",
    },
  };

  const c = copy[outcome];
  const accent = outcome === "accepted" ? "#16a34a" : outcome === "declined" ? "#dc2626" : "#6b7280";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f9fafb;color:#111827">
  <div style="max-width:480px;margin:48px auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;text-align:center">
    <div style="font-size:40px;line-height:1;margin-bottom:12px">${outcome === "accepted" ? "✅" : outcome === "declined" ? "❌" : "⚠️"}</div>
    <h1 style="font-size:22px;margin:0 0 12px 0;color:${accent}">${c.title}</h1>
    <p style="font-size:15px;line-height:1.5;color:#374151;margin:0">${c.body}</p>
  </div>
</body></html>`;
}

function escapeHtmlText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
