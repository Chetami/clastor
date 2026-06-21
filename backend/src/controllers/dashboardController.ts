import { Request, Response } from "express";
import {
  DashboardPeriod,
  DashboardSummaryResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { getDashboardSummary } from "../services/dashboardService";

const VALID_PERIODS: DashboardPeriod[] = [
  "week",
  "month",
  "six_months",
  "year",
];

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

    const raw = (req.query.period as string | undefined) ?? "week";
    const period = VALID_PERIODS.includes(raw as DashboardPeriod)
      ? (raw as DashboardPeriod)
      : "week";

    const summary = await getDashboardSummary(req.user.uid, req.user.role, period);

    res.status(200).json(summary);
  } catch (error) {
    console.error("Dashboard summary failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard summary";
    res.status(500).json({ message });
  }
}
