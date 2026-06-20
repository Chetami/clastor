import { useQuery } from "@tanstack/react-query";
import { listStudentsRequest } from "./requests";
import type { Student } from "@examify-tms/interfaces";

export function useListStudents() {
  return useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const response = await listStudentsRequest();
      return response.data;
    },
  });
}
