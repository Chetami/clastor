import { useQuery } from "@tanstack/react-query";
import { getAdminOverviewRequest } from "./requests";
import type { DashboardPeriod } from "@examify-tms/interfaces";

export function useAdminOverview(period: DashboardPeriod) {
  return useQuery({
    queryKey: ["admin-overview", period],
    queryFn: () => getAdminOverviewRequest(period),
  });
}
