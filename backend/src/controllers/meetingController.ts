import { Request, Response } from "express";
import { GenerateMeetLinkRequest, GenerateMeetLinkResponse, ApiError } from "@examify-tms/interfaces";
import { generateMeetLink } from "../services/meetService";

/**
 * POST /api/meetings
 * Generate a Google Meet link via a backing Calendar event.
 * Optional body: { startDateTime?, durationMinutes? }
 */
export async function generateMeetingLink(
  req: Request<{}, {}, GenerateMeetLinkRequest>,
  res: Response<GenerateMeetLinkResponse | ApiError>,
): Promise<void> {
  try {
    const { startDateTime, durationMinutes } = req.body ?? {};

    const result = await generateMeetLink({
      startDateTime,
      durationMinutes,
    });

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate meeting link";
    console.error("generateMeetingLink error:", error);
    res.status(500).json({ message });
  }
}
