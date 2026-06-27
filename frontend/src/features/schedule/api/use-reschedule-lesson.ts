import { useMutation } from "@tanstack/react-query";
import { rescheduleLessonRequest } from "./requests";
import type { RescheduleLessonRequest, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useRescheduleLesson(id: string) {
  return useMutation<LessonResponse, Error, RescheduleLessonRequest>({
    mutationFn: (data: RescheduleLessonRequest) => rescheduleLessonRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
