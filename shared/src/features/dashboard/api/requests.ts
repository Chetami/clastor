import { api } from "../../../lib/api";
import type { DashboardPeriod, DashboardSummaryResponse } from "@examify-tms/interfaces";
// `generateMeetLinkRequest` and `recordAttendanceRequest` are owned by the
// schedule feature (identical implementations); re-export them here so the
// dashboard hooks can import from a single local module without duplicating
// the request bodies.
export {
  generateMeetLinkRequest,
  recordAttendanceRequest,
} from "../../schedule/api/requests";

export async function getDashboardSummaryRequest(
  period: DashboardPeriod,
): Promise<DashboardSummaryResponse> {
  const response = await api.get<DashboardSummaryResponse>(
    "/api/dashboard/summary",
    { params: { period } },
  );
  return response.data;
}
