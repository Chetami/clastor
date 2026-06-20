import { useMutation } from "@tanstack/react-query";
import { createRecurringLessonRequest } from "./requests";
import type {
  CreateRecurringLessonRequest,
  CreateRecurringLessonResponse,
} from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useCreateRecurringLesson() {
  return useMutation<
    CreateRecurringLessonResponse,
    Error,
    CreateRecurringLessonRequest
  >({
    mutationFn: (data: CreateRecurringLessonRequest) =>
      createRecurringLessonRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}
