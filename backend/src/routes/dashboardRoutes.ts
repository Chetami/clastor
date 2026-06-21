import { Router } from "express";
import { getDashboardSummaryHandler } from "../controllers/dashboardController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

/**
 * GET /api/dashboard/summary?period=week|month|six_months|year
 * Aggregated dashboard metrics for the authenticated user.
 */
router.get("/summary", authenticateJWT, getDashboardSummaryHandler);

export default router;
