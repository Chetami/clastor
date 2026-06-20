import { Router } from "express";
import {
  createLesson,
  listLessons,
  getLessonById,
  updateLesson,
  recordAttendance,
  cancelLesson,
  notifyStudent,
  rsvpLesson,
} from "../controllers/lessonController";
import {
  createRecurringLesson,
  getLessonSeries,
  updateLessonSeries,
  cancelLessonSeries,
} from "../controllers/lessonSeriesController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/lessons
 * List lessons — supports from/to (calendar window), studentId,
 * acceptanceStatus and attendanceStatus filters.
 */
router.get("/", authenticateJWT, listLessons);

/**
 * GET /api/lessons/rsvp?token=...&status=accepted|declined
 * Public one-click RSVP, reached from the Accept/Decline buttons in the
 * invite email. Registered before /:id so "rsvp" isn't captured as an id.
 * Returns a confirmation HTML page.
 */
router.get("/rsvp", rsvpLesson);

/**
 * GET /api/lessons/series/:id
 * Get a recurring lesson series by ID.
 * (Registered before /:id so "series" isn't captured as an id.)
 */
router.get("/series/:id", authenticateJWT, getLessonSeries);

/**
 * GET /api/lessons/:id
 * Get a single lesson by ID.
 */
router.get("/:id", authenticateJWT, getLessonById);

/**
 * POST /api/lessons
 * Create a one-off lesson linked to the authenticated tutor.
 */
router.post(
  "/",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  createLesson
);

/**
 * POST /api/lessons/recurring
 * Create a recurring lesson series; expands into individual occurrences.
 */
router.post(
  "/recurring",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  createRecurringLesson
);

/**
 * PATCH /api/lessons/:id
 * Update a lesson's timing, notes, location, acceptance or reminders.
 * Marks a series occurrence as an exception.
 */
router.patch(
  "/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  updateLesson
);

/**
 * PATCH /api/lessons/series/:id
 * Update a series template (propagates to future occurrences).
 */
router.patch(
  "/series/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  updateLessonSeries
);

/**
 * DELETE /api/lessons/series/:id
 * Cancel all future occurrences of a series (soft cancel).
 */
router.delete(
  "/series/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  cancelLessonSeries
);

/**
 * PATCH /api/lessons/:id/attendance
 * Record the post-lesson attendance/outcome.
 */
router.patch(
  "/:id/attendance",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  recordAttendance
);

/**
 * PATCH /api/lessons/:id/cancel
 * Soft-cancel a single lesson occurrence.
 */
router.patch(
  "/:id/cancel",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  cancelLesson
);

/**
 * POST /api/lessons/:id/notify-student
 * Send a reminder email to the student for this lesson. Subject to a
 * cooldown to prevent spamming / accidental double-sends.
 */
router.post(
  "/:id/notify-student",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  notifyStudent
);

export default router;
