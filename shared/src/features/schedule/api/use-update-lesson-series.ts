import { useMutation } from "@tanstack/react-query";
import { updateLessonSeriesRequest } from "./requests";
import type {
  UpdateLessonSeriesRequest,
  LessonSeriesResponse,
} from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

/**
 * Update a lesson series template. Propagates template fields (including
 * acceptance status) to future non-exception occurrences server-side.
 */
export function useUpdateLessonSeries(seriesId: string) {
  return useMutation<LessonSeriesResponse, Error, UpdateLessonSeriesRequest>({
    mutationFn: (data: UpdateLessonSeriesRequest) =>
      updateLessonSeriesRequest(seriesId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}
