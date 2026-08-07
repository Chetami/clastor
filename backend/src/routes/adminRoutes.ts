import { Router } from "express";
import {
  getAdminOverviewHandler,
  listTutorsHandler,
} from "../controllers/adminController";
import { validateRequest } from "../middleware/validateRequest";
import { periodQuerySchema } from "../schemas";

const router = Router();

/**
 * All /api/admin routes require an authenticated system admin.
 * The authenticateJWT + requireSystemAdmin gates are applied at mount time
 * in server.ts so every route added here is protected by default.
 */
router.get("/overview", validateRequest({ query: periodQuerySchema }), getAdminOverviewHandler);
router.get("/tutors", listTutorsHandler);

export default router;
