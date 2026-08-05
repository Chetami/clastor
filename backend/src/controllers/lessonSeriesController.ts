import { Request, Response } from "express";
import {
  createLessonSeriesInFirestore,
  updateLessonSeriesInFirestore,
  cancelLessonSeriesFuture,
  getLessonSeriesByIdFromFirestore,
  setSeriesMeetLinkInFirestore,
} from "../services/lessonSeriesService";
import { listLessonsBySeriesFromFirestore } from "../services/lessonService";
import {
  syncLessonToCalendar,
  deleteLessonCalendarEvent,
  attachMeetLinkToCalendarEvent,
} from "../services/googleCalendarService";
import {
  generateMeetLinkForUser,
  GoogleNotConnectedError,
} from "../services/meetService";
import {
  CreateRecurringLessonRequest,
  UpdateLessonSeriesRequest,
  LessonSeries,
  LessonSeriesResponse,
  CreateRecurringLessonResponse,
  GenerateSeriesMeetLinkResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewSeries, canEditSeries } from "../permissions/lessonSeriesPermissions";

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
 * every upcoming lesson:
 *   1. Ensure every upcoming occurrence has a backing Google Calendar event.
 *   2. Provision a single Meet conference on the first upcoming lesson's
 *      calendar event (this mints the shared Meet URL).
 *   3. Persist that URL on the series + every non-cancelled occurrence.
 *   4. Attach the same Meet link to each remaining upcoming lesson's calendar
 *      event so every session shows the same "Join" button (best-effort).
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

    // 1. Upcoming non-cancelled occurrences to attach Meet to.
    let upcoming = await listLessonsBySeriesFromFirestore(req.params.id, {
      futureOnly: true,
    });
    if (upcoming.length === 0) {
      res.status(400).json({
        message: "This series has no upcoming lessons to attach a Meet link to",
      });
      return;
    }

    // Ensure each upcoming lesson has a Google Calendar event so we can
    // attach the Meet conference to it. Best-effort; failures are logged.
    await Promise.allSettled(upcoming.map((l) => syncLessonToCalendar(uid, l)));

    // Reload to pick up fresh googleCalendarEventIds from the sync above.
    upcoming = await listLessonsBySeriesFromFirestore(req.params.id, {
      futureOnly: true,
    });

    const first = upcoming[0];

    // 2. Provision the shared Meet link on the first lesson's calendar event.
    //    generateMeetLinkForUser attaches conferenceData to the lesson's
    //    existing event (or creates one) and returns the minted Meet URL.
    const { meetingLink } = await generateMeetLinkForUser(uid, {
      lessonId: first.id,
    });

    // 3. Persist the shared link on the series + all non-cancelled lessons.
    await setSeriesMeetLinkInFirestore(req.params.id, meetingLink);

    // 4. Attach the same Meet link to every OTHER upcoming lesson's event.
    //    Best-effort: a single event failing must not roll back the rest.
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
        `[series-meet] ${calendarFailed}/${others.length} calendar events could not be updated for series ${req.params.id}`,
      );
    }

    const response: GenerateSeriesMeetLinkResponse = {
      meetingLink,
      appliedTo: upcoming.length,
      calendarFailed,
    };
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res.status(409).json({ message: error.message });
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
