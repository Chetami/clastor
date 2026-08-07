import { Request, Response } from "express";
import {
  DashboardPeriod,
  DashboardSummaryResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { getDashboardSummary } from "../services/dashboardService";

/**
 * GET /api/dashboard/summary?period=week|month|six_months|year
 * Returns aggregated metrics for the authenticated tutor's dashboard.
 */
export async function getDashboardSummaryHandler(
  req: Request,
  res: Response<DashboardSummaryResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // `period` is validated + defaulted to "week" by the route's query schema.
    const period = req.query.period as DashboardPeriod;

    const summary = await getDashboardSummary(req.user.uid, req.user.role, period);

    res.status(200).json(summary);
  } catch (error) {
    console.error("Dashboard summary failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard summary";
    res.status(500).json({ message });
  }
}
