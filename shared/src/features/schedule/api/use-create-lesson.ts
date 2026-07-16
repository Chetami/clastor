import { useMutation } from "@tanstack/react-query";
import { createLessonRequest } from "./requests";
import type { CreateLessonRequest, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useCreateLesson() {
  return useMutation<LessonResponse, Error, CreateLessonRequest>({
    mutationFn: (data: CreateLessonRequest) => createLessonRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}
