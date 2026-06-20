import { useMutation } from "@tanstack/react-query";
import { cancelLessonRequest } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useCancelLesson(id: string) {
  return useMutation<LessonResponse, Error, void>({
    mutationFn: () => cancelLessonRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
