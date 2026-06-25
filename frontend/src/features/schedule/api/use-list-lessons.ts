import { useQuery } from "@tanstack/react-query";
import { listLessonsRequest, type ListLessonsParams } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";

/**
 * Fetch lessons, unwrapping to a `LessonResponse[]`.
 *
 * Omits `limit` so the full matching set is returned — used by the
 * dashboard, the calendar-window fetch and invoice creation. For the
 * paginated lessons list use `useListLessonsInfinite` instead.
 */
export function useListLessons(
  params?: ListLessonsParams,
  opts?: { enabled?: boolean },
) {
  return useQuery<LessonResponse[]>({
    queryKey: ["lessons", params],
    queryFn: async () => {
      const response = await listLessonsRequest(params);
      return response.data;
    },
    enabled: opts?.enabled,
  });
}
