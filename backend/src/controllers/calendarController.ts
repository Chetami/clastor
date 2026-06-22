import { Request, Response } from "express";
import {
  ExternalCalendarEventListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import {
  listExternalCalendarEvents,
  backfillUpcomingLessons,
  GoogleNotConnectedError,
} from "../services/googleCalendarService";

/**
 * GET /api/calendar/events?from=&to=
 * List external (non-lesson) events from the tutor's primary Google Calendar
 * for the given time window. Returns an empty list if Google isn't connected.
 *
 * Query:
 *   from - ISO 8601 start (inclusive)
 *   to   - ISO 8601 end (exclusive)
 */
export async function listExternalEvents(
  req: Request,
  res: Response<ExternalCalendarEventListResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const fromRaw = req.query.from;
    const toRaw = req.query.to;
    if (typeof fromRaw !== "string" || typeof toRaw !== "string") {
      res
        .status(400)
        .json({ message: "Both 'from' and 'to' query params are required" });
      return;
    }

    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      res.status(400).json({ message: "'from' and 'to' must be valid ISO dates" });
      return;
    }

    let data: ExternalCalendarEventListResponse["data"] = [];
    try {
      data = await listExternalCalendarEvents(req.user.uid, from, to);
    } catch (error) {
      if (error instanceof GoogleNotConnectedError) {
        // Not connected → return an empty list (frontend gates the call too).
        data = [];
      } else {
        throw error;
      }
    }

    res.status(200).json({ data, total: data.length });
  } catch (error) {
    console.error("List external calendar events failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list calendar events";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/calendar/sync
 * Manually reconcile all upcoming lessons with Google Calendar: pushes lessons
 * that aren't on Google yet AND recreates events that were deleted on Google's
 * side. Intended for the "Sync all lessons" button in Settings.
 */
export async function syncLessons(
  req: Request,
  res: Response<{ pushed: number; recovered: number; skipped: number } | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await backfillUpcomingLessons(req.user.uid);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res
        .status(400)
        .json({ message: "Connect your Google account first." });
      return;
    }
    console.error("Calendar sync failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync calendar";
    res.status(500).json({ message });
  }
}
