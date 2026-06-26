import { Router } from "express";
import {
  listAllTemplates,
  getInvoicePreview,
  getLessonReminderPreview,
  getMeetInvitePreview,
  getReschedulePreview,
  getCancellationPreview,
} from "../controllers/templateController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

/**
 * Template preview routes. All read-only — these render the app's sendable
 * templates against fixed sample data so tutors can see exactly what an
 * invoice, reminder, or Meet invite will look like. Tutors + admins only.
 */
router.use(authenticateJWT, requireRole("tutor", "system_admin"));

router.get("/", listAllTemplates);
router.get("/invoice/preview", getInvoicePreview);
router.get("/lesson-reminder/preview", getLessonReminderPreview);
router.get("/meet-invite/preview", getMeetInvitePreview);
router.get("/reschedule/preview", getReschedulePreview);
router.get("/cancellation/preview", getCancellationPreview);

export default router;
