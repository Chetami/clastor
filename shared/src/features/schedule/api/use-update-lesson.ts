import { useMutation } from "@tanstack/react-query";
import { updateLessonRequest } from "./requests";
import type { UpdateLessonRequest, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useUpdateLesson(id: string) {
  return useMutation<LessonResponse, Error, UpdateLessonRequest>({
    mutationFn: (data: UpdateLessonRequest) => updateLessonRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
