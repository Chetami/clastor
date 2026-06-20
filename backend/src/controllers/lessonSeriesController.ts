import { Request, Response } from "express";
import {
  createLessonSeriesInFirestore,
  updateLessonSeriesInFirestore,
  cancelLessonSeriesFuture,
  getLessonSeriesByIdFromFirestore,
} from "../services/lessonSeriesService";
import {
  CreateRecurringLessonRequest,
  UpdateLessonSeriesRequest,
  LessonSeries,
  LessonSeriesResponse,
  CreateRecurringLessonResponse,
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
    res.status(200).json({ cancelled });
  } catch (error) {
    console.error("Cancel lesson series failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to cancel lesson series";
    res.status(500).json({ message });
  }
}
