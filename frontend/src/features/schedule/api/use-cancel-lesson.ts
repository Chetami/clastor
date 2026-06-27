import { useMutation } from "@tanstack/react-query";
import { cancelLessonRequest } from "./requests";
import type { CancelLessonRequest, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useCancelLesson(id: string) {
  return useMutation<LessonResponse, Error, CancelLessonRequest | void>({
    mutationFn: (data) => cancelLessonRequest(id, data ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
