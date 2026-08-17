import { Router } from "express";
import { createContactMessage } from "../controllers/contactController";
import { validateRequest } from "../middleware/validateRequest";
import { contactLimiter } from "../middleware/rateLimit";
import { createContactMessageSchema } from "../schemas";

const router = Router();

/**
 * POST /api/contact
 * Public website contact form. No auth — submissions are forwarded to the
 * team Discord channel via webhook (see services/contactService.ts).
 */
router.post(
  "/",
  contactLimiter,
  validateRequest({ body: createContactMessageSchema }),
  createContactMessage,
);

export default router;
