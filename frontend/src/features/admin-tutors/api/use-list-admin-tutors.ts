import { useQuery } from "@tanstack/react-query";
import { listAdminTutorsRequest } from "./requests";
import type { AdminTutorSummary } from "@examify-tms/interfaces";

export function useListAdminTutors() {
  return useQuery<AdminTutorSummary[]>({
    queryKey: ["admin-tutors"],
    queryFn: async () => {
      const response = await listAdminTutorsRequest();
      return response.data;
    },
  });
}
