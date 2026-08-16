import { Router } from "express";
import { listExternalEvents, syncLessons } from "../controllers/calendarController";
import { authenticateJWT, requireRole, requireVerifiedEmail } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { calendarEventsQuerySchema } from "../schemas";

const router = Router();

/**
 * GET /api/calendar/events?from=&to=
 * External (non-lesson) Google Calendar events for the visible time window.
 */
router.get("/events", authenticateJWT, requireRole("tutor", "system_admin"), validateRequest({ query: calendarEventsQuerySchema }), listExternalEvents);

/**
 * POST /api/calendar/sync
 * Manually backfill all upcoming lessons to Google Calendar.
 */
router.post("/sync", authenticateJWT, requireRole("tutor", "system_admin"), requireVerifiedEmail, syncLessons);

export default router;
