import { api } from "../../../lib/api";
import type {
  DashboardPeriod,
  AdminOverviewResponse,
} from "@examify-tms/interfaces";

export async function getAdminOverviewRequest(
  period: DashboardPeriod,
): Promise<AdminOverviewResponse> {
  const response = await api.get<AdminOverviewResponse>(
    "/api/admin/overview",
    { params: { period } },
  );
  return response.data;
}
