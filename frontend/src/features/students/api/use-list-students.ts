import { useQuery } from "@tanstack/react-query";
import { listStudentsRequest } from "./requests";
import type { StudentResponse } from "@examify-tms/interfaces";

export function useListStudents() {
  return useQuery<StudentResponse[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const response = await listStudentsRequest();
      return response.data;
    },
  });
}
