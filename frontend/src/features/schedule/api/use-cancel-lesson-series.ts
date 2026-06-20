import { useMutation } from "@tanstack/react-query";
import { cancelLessonSeriesRequest } from "./requests";
import { queryClient } from "@/lib/query-client";

export function useCancelLessonSeries() {
  return useMutation<{ cancelled: number }, Error, string>({
    mutationFn: (seriesId: string) => cancelLessonSeriesRequest(seriesId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}
