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

/**
 * POST /api/meetings
 * Generate a Google Meet link in the authenticated tutor's own calendar.
 * Optional body: { startDateTime?, durationMinutes? }.
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

    const { startDateTime, durationMinutes } = req.body ?? {};

    const result = await generateMeetLinkForUser(req.user.uid, {
      startDateTime,
      durationMinutes,
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
