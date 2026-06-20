import { Router } from "express";
import { generateMeetingLink } from "../controllers/meetingController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

/**
 * POST /api/meetings
 * Generate a Google Meet link. Optional body: { startDateTime?, durationMinutes? }.
 */
router.post(
  "/",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  generateMeetingLink,
);

export default router;
