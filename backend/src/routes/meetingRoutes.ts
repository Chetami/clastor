import { Router } from "express";
import { generateMeetingLink } from "../controllers/meetingController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { generateMeetLinkSchema } from "../schemas";

const router = Router();

/**
 * POST /api/meetings
 * Generate a Google Meet link. Optional body: { startDateTime?, durationMinutes? }.
 */
router.post(
  "/",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  validateRequest({ body: generateMeetLinkSchema }),
  generateMeetingLink,
);

export default router;
