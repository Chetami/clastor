import { useQuery } from "@tanstack/react-query";
import { getDashboardSummaryRequest } from "./requests";
import type { DashboardPeriod } from "@examify-tms/interfaces";

export function useDashboardSummary(period: DashboardPeriod) {
  return useQuery({
    queryKey: ["dashboard-summary", period],
    queryFn: () => getDashboardSummaryRequest(period),
  });
}
