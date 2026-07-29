import { useQuery } from "@tanstack/react-query";
import { getStudentRequest } from "./requests";

export function useGetStudent(id: string | undefined) {
  return useQuery({
    queryKey: ["students", id],
    queryFn: () => getStudentRequest(id!),
    enabled: !!id,
  });
}
