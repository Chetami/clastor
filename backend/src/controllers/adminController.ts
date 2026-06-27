import { Request, Response } from "express";
import {
  DashboardPeriod,
  AdminOverviewResponse,
  AdminTutorListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import {
  getAdminOverview,
  listTutorsWithStats,
} from "../services/adminDashboardService";

const VALID_PERIODS: DashboardPeriod[] = [
  "week",
  "month",
  "six_months",
  "year",
];

/**
 * GET /api/admin/overview?period=week|month|six_months|year
 * Platform-wide overview for the system admin dashboard.
 */
export async function getAdminOverviewHandler(
  _req: Request,
  res: Response<AdminOverviewResponse | ApiError>,
): Promise<void> {
  try {
    const req = _req;
    const raw = (req.query.period as string | undefined) ?? "week";
    const period = VALID_PERIODS.includes(raw as DashboardPeriod)
      ? (raw as DashboardPeriod)
      : "week";

    const overview = await getAdminOverview(period);
    res.status(200).json(overview);
  } catch (error) {
    console.error("Admin overview failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load admin overview";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/admin/tutors
 * Lists all tutors with per-tutor stats for the admin tutors page.
 */
export async function listTutorsHandler(
  _req: Request,
  res: Response<AdminTutorListResponse | ApiError>,
): Promise<void> {
  try {
    const data = await listTutorsWithStats();
    res.status(200).json({ data, total: data.length });
  } catch (error) {
    console.error("List tutors failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load tutors";
    res.status(500).json({ message });
  }
}
