import { Router } from "express";
import { getDashboardSummaryHandler } from "../controllers/dashboardController";
import { authenticateJWT } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { periodQuerySchema } from "../schemas";

const router = Router();

/**
 * GET /api/dashboard/summary?period=week|month|six_months|year
 * Aggregated dashboard metrics for the authenticated user.
 */
router.get("/summary", authenticateJWT, validateRequest({ query: periodQuerySchema }), getDashboardSummaryHandler);

export default router;
