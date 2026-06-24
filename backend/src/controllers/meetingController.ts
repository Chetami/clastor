import { Request, Response } from "express";
import {
  GenerateMeetLinkRequest,
  GenerateMeetLinkResponse,
  ApiError,
} from "@examify-tms/interfaces";
import {
  generateMeetLinkForUser,
  GoogleNotConnectedError,
} from "../services/meetService";
import { getLessonByIdFromFirestore } from "../services/lessonService";
import { canEditLesson } from "../permissions/lessonPermissions";

/**
 * POST /api/meetings
 * Generate a Google Meet link in the authenticated tutor's own calendar.
 * Optional body: { startDateTime?, durationMinutes?, lessonId? }.
 *
 * When `lessonId` is provided, the caller must own (or be admin of) that
 * lesson, and the Meet conference is attached to the lesson's existing Google
 * Calendar event rather than creating a duplicate entry.
 */
export async function generateMeetingLink(
  req: Request<{}, {}, GenerateMeetLinkRequest>,
  res: Response<GenerateMeetLinkResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { startDateTime, durationMinutes, lessonId } = req.body ?? {};

    if (lessonId) {
      const lesson = await getLessonByIdFromFirestore(lessonId);
      if (!lesson) {
        res.status(404).json({ message: "Lesson not found" });
        return;
      }
      if (!canEditLesson(lesson, req)) {
        res.status(403).json({
          message: "Forbidden: You do not have permission to generate a Meet link for this lesson",
        });
        return;
      }
    }

    const result = await generateMeetLinkForUser(req.user.uid, {
      startDateTime,
      durationMinutes,
      lessonId,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res.status(409).json({ message: error.message });
      return;
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate meeting link";
    console.error("generateMeetingLink error:", error);
    res.status(500).json({ message });
  }
}
