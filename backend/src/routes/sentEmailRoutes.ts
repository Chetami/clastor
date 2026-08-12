import { Router } from "express";
import { listSentEmails, getSentEmail } from "../controllers/sentEmailController";
import { authenticateJWT } from "../middleware/auth";
import { requireFeature } from "../middleware/featureFlags";

const router = Router();

// Whole router is gated by the sentEmails flag. Note: this only controls the
// read surface (list/view). Outbound emails are still recorded via
// recordSentEmailSafe when emails are dispatched.
router.use(requireFeature("sentEmails"));

/**
 * GET /api/sent-emails
 * List outbound email attempts. Pass exactly one of: ?lessonId=, ?invoiceId=,
 * ?studentId= to scope to that entity. System admins may omit the filter to
 * get the most recent sends globally. Newest-first.
 */
router.get("/", authenticateJWT, listSentEmails);

/**
 * GET /api/sent-emails/:id
 * Fetch a single sent-email record, including the full rendered HTML body.
 */
router.get("/:id", authenticateJWT, getSentEmail);

export default router;
