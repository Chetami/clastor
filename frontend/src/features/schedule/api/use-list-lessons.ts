import { useQuery } from "@tanstack/react-query";
import { listLessonsRequest } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";

export function useListLessons(params?: {
  from?: string;
  to?: string;
  studentId?: string;
}) {
  return useQuery<LessonResponse[]>({
    queryKey: ["lessons", params],
    queryFn: async () => {
      const response = await listLessonsRequest(params);
      return response.data;
    },
  });
}
