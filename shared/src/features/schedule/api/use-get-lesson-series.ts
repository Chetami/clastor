import { useQuery } from "@tanstack/react-query";
import { getLessonSeriesRequest } from "./requests";

/**
 * Fetch a lesson series (metadata) by ID. Occurrences are fetched
 * separately via `useListLessons({ seriesId })`.
 */
export function useGetLessonSeries(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["lessons", "series", seriesId],
    queryFn: () => getLessonSeriesRequest(seriesId!),
    enabled: !!seriesId,
  });
}
