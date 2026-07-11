import { Router } from "express";
import { listSentEmails, getSentEmail } from "../controllers/sentEmailController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

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
