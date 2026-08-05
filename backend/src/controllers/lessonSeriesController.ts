import { Request, Response } from "express";
import {
  createLessonSeriesInFirestore,
  updateLessonSeriesInFirestore,
  cancelLessonSeriesFuture,
  getLessonSeriesByIdFromFirestore,
  generateSeriesMeetLinkForUser,
  SeriesNoUpcomingLessonsError,
  isMeetLocation,
} from "../services/lessonSeriesService";
import { listLessonsBySeriesFromFirestore } from "../services/lessonService";
import {
  syncLessonToCalendar,
  deleteLessonCalendarEvent,
} from "../services/googleCalendarService";
import {
  GoogleNotConnectedError,
} from "../services/meetService";
import {
  CreateRecurringLessonRequest,
  UpdateLessonSeriesRequest,
  LessonSeries,
  LessonSeriesResponse,
  CreateRecurringLessonResponse,
  GenerateSeriesMeetLinkResponse,
  NotifyStudentRequest,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewSeries, canEditSeries } from "../permissions/lessonSeriesPermissions";
import { getStudentByIdFromFirestore } from "../services/studentService";
import { getUserFromFirestore } from "../services/userService";
import { sendSeriesNotificationEmail } from "../services/emailService";
import { recordSentEmailSafe } from "../services/sentEmailService";
import { markStudentNotifiedInFirestore } from "../services/lessonService";
import { getNotifyCooldownMs } from "../config/email";

function toSeriesResponse(series: LessonSeries): LessonSeriesResponse {
  const toIso = (v: any) => (v instanceof Date ? v.toISOString() : v);
  return {
    id: series.id,
    studentId: series.studentId,
    subject: series.subject,
    durationMinutes: series.durationMinutes,
    location: series.location ?? null,
    meetLink: series.meetLink ?? null,
    notes: series.notes ?? null,
    intervalWeeks: series.intervalWeeks,
    slots: series.slots,
    timezone: series.timezone,
    startDate: series.startDate,
    until: series.until ?? null,
    count: series.count ?? null,
    acceptanceStatus: series.acceptanceStatus,
    remindersEnabled: series.remindersEnabled,
    createdAt: toIso(series.createdAt),
    updatedAt: toIso(series.updatedAt),
  };
}

/**
 * Create a recurring lesson series.
 */
export async function createRecurringLesson(
  req: Request<{}, {}, CreateRecurringLessonRequest>,
  res: Response<CreateRecurringLessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!Array.isArray(req.body.slots) || req.body.slots.length === 0) {
      res.status(400).json({ message: "At least one slot is required" });
      return;
    }

    const hasUntil = req.body.until !== undefined && req.body.until !== null;
    const hasCount = req.body.count !== undefined && req.body.count !== null;
    if (hasUntil === hasCount) {
      res
        .status(400)
        .json({ message: "Exactly one of 'until' or 'count' must be provided" });
      return;
    }

    const result = await createLessonSeriesInFirestore(req.body, req.user.uid);

    // Best-effort push every upcoming occurrence to Google Calendar.
    // Never blocks the response; failures are logged inside the sync helper.
    try {
      const upcoming = await listLessonsBySeriesFromFirestore(result.seriesId, {
        futureOnly: true,
      });
      await Promise.all(
        upcoming.map((l) => syncLessonToCalendar(req.user!.uid, l)),
      );
    } catch {
      /* logged inside syncLessonToCalendar */
    }

    // Auto-generate a shared Google Meet link when the series is set to use
    // Google Meet, and persist it on the series + every occurrence. Best-effort:
    // if the tutor isn't connected to Google (or Meet provisioning fails), the
    // series is still created and they can generate the link from the series page.
    if (isMeetLocation(req.body.location)) {
      try {
        await generateSeriesMeetLinkForUser(req.user.uid, result.seriesId);
      } catch (error) {
        if (error instanceof GoogleNotConnectedError) {
          console.warn(
            `[series-meet] Google not connected; skipping auto Meet link for series ${result.seriesId}`,
          );
        } else if (!(error instanceof SeriesNoUpcomingLessonsError)) {
          console.error(
            `[series-meet] Failed to auto-generate Meet link for series ${result.seriesId}:`,
            error,
          );
        }
      }
    }

    const response: CreateRecurringLessonResponse = {
      seriesId: result.seriesId,
      count: result.count,
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Create recurring lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create recurring lesson";
    res.status(500).json({ message });
  }
}

/**
 * Get a lesson series by ID.
 */
export async function getLessonSeries(
  req: Request<{ id: string }>,
  res: Response<LessonSeriesResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const series = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }

    if (!canViewSeries(series, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to view this series" });
      return;
    }

    res.status(200).json(toSeriesResponse(series));
  } catch (error) {
    console.error("Get lesson series failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get lesson series";
    res.status(500).json({ message });
  }
}

/**
 * Update a lesson series template (propagates to future occurrences).
 */
export async function updateLessonSeries(
  req: Request<{ id: string }, {}, UpdateLessonSeriesRequest>,
  res: Response<LessonSeriesResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const series = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }

    if (!canEditSeries(series, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this series" });
      return;
    }

    await updateLessonSeriesInFirestore(req.params.id, req.body);

    // Re-sync the future (non-exception) occurrences to Google so titles/
    // times/locations reflect the template change.
    try {
      const upcoming = await listLessonsBySeriesFromFirestore(req.params.id, {
        futureOnly: true,
      });
      await Promise.all(
        upcoming.map((l) => syncLessonToCalendar(req.user!.uid, l)),
      );
    } catch {
      /* logged inside syncLessonToCalendar */
    }

    const updated = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }

    res.status(200).json(toSeriesResponse(updated));
  } catch (error) {
    console.error("Update lesson series failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update lesson series";
    res.status(500).json({ message });
  }
}

/**
 * Cancel all future occurrences of a series (soft cancel).
 */
export async function cancelLessonSeries(
  req: Request<{ id: string }>,
  res: Response<{ cancelled: number } | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const series = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }

    if (!canEditSeries(series, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to cancel this series" });
      return;
    }

    const cancelled = await cancelLessonSeriesFuture(req.params.id);

    // Best-effort delete the Google Calendar events for the cancelled
    // occurrences.
    try {
      const upcoming = await listLessonsBySeriesFromFirestore(req.params.id);
      const toRemove = upcoming.filter(
        (l) => l.isCancelled && l.googleCalendarEventId,
      );
      await Promise.all(
        toRemove.map((l) =>
          deleteLessonCalendarEvent(req.user!.uid, l.googleCalendarEventId),
        ),
      );
    } catch {
      /* logged inside deleteLessonCalendarEvent */
    }

    res.status(200).json({ cancelled });
  } catch (error) {
    console.error("Cancel lesson series failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to cancel lesson series";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/lessons/series/:id/generate-meet
 *
 * Generate ONE shared Google Meet link for an entire series and apply it to
 * every upcoming lesson. Delegates to the shared
 * {@link generateSeriesMeetLinkForUser} service (also used to auto-provision
 * a Meet link when a series is created with a Meet location).
 */
export async function generateSeriesMeetLink(
  req: Request<{ id: string }>,
  res: Response<GenerateSeriesMeetLinkResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const uid = req.user.uid;

    const series = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }
    if (!canEditSeries(series, req)) {
      res.status(403).json({
        message: "Forbidden: You do not have permission to generate a Meet link for this series",
      });
      return;
    }

    const response = await generateSeriesMeetLinkForUser(uid, req.params.id);
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error instanceof SeriesNoUpcomingLessonsError) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error("Generate series Meet link failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate Meet link for series";
    res.status(500).json({ message });
  }
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
 * POST /api/lessons/series/:id/notify-student
 *
 * Send ONE summary email to the student covering every upcoming, non-cancelled
 * occurrence in the series — instead of one email per lesson. The email lists
 * each upcoming lesson with its date/time in the tutor's timezone.
 *
 * Subject to a series-level cooldown (same window as per-lesson notifies): if
 * any upcoming lesson was notified within the window, the whole send is
 * blocked so the student isn't spammed with the same summary repeatedly. On
 * success every upcoming lesson is stamped as notified.
 */
export async function notifySeriesStudent(
  req: Request<{ id: string }, {}, NotifyStudentRequest>,
  res: Response<{ notified: number } | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const series = await getLessonSeriesByIdFromFirestore(req.params.id);
    if (!series) {
      res.status(404).json({ message: "Lesson series not found" });
      return;
    }

    if (!canEditSeries(series, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to notify for this series" });
      return;
    }

    const upcoming = await listLessonsBySeriesFromFirestore(req.params.id, {
      futureOnly: true,
    });
    if (upcoming.length === 0) {
      res
        .status(400)
        .json({ message: "This series has no upcoming lessons to notify about" });
      return;
    }

    // Series-level cooldown: block if any upcoming lesson was notified within
    // the window, reporting when the next send is allowed.
    const cooldownMs = getNotifyCooldownMs();
    let nextAllowedAt: Date | null = null;
    for (const lesson of upcoming) {
      if (!lesson.lastStudentNotifiedAt) continue;
      const last = new Date(lesson.lastStudentNotifiedAt as any).getTime();
      if (Date.now() - last < cooldownMs) {
        const candidate = new Date(last + cooldownMs);
        if (!nextAllowedAt || candidate.getTime() > nextAllowedAt.getTime()) {
          nextAllowedAt = candidate;
        }
      }
    }
    if (nextAllowedAt) {
      res.status(409).json({
        message: `A summary email was already sent recently. You can send another after ${nextAllowedAt.toISOString()}.`,
      });
      return;
    }

    const student = await getStudentByIdFromFirestore(series.studentId);
    if (!student || !student.email) {
      res
        .status(400)
        .json({ message: "This student has no email address on file" });
      return;
    }
    const tutor = await getUserFromFirestore(series.tutorId);

    try {
      const content = await sendSeriesNotificationEmail({
        to: student.email,
        studentName: student.name,
        tutorName: tutor.name,
        tutorEmail: tutor.email,
        subject: series.subject ?? null,
        timezone: series.timezone ?? null,
        lessons: upcoming.map((l) => ({
          startDateTime: new Date(l.startDateTime as any),
          durationMinutes: l.durationMinutes,
          location: l.meetLink ?? l.location,
        })),
        message: req.body?.message ?? null,
      });

      await recordSentEmailSafe({
        type: "lesson_notify",
        to: student.email,
        subject: content.subject,
        status: "sent",
        bodyHtml: content.html,
        tutorId: series.tutorId,
        studentId: series.studentId,
        sentBy: req.user.uid,
        sentByName: await safeGetActorName(req.user.uid),
      });
    } catch (sendError) {
      await recordSentEmailSafe({
        type: "lesson_notify",
        to: student.email,
        subject: "",
        status: "failed",
        errorMessage:
          sendError instanceof Error ? sendError.message : String(sendError),
        bodyHtml: "",
        tutorId: series.tutorId,
        studentId: series.studentId,
        sentBy: req.user.uid,
        sentByName: await safeGetActorName(req.user.uid),
      });
      throw sendError;
    }

    // Stamp every upcoming lesson as notified only after delivery succeeds.
    await Promise.all(upcoming.map((l) => markStudentNotifiedInFirestore(l.id)));

    res.status(200).json({ notified: upcoming.length });
  } catch (error) {
    console.error("Notify lesson series failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to notify student";
    res.status(500).json({ message });
  }
}
