import { useMutation } from "@tanstack/react-query";
import { updateLessonRequest } from "../../schedule/api/requests";
import type {
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

/**
 * Patch a lesson's editable details (subject, duration, …) by id. Mirrors
 * useMarkLessonDone: takes a variable id so the dashboard can update any
 * lesson in place. Invalidates lesson + dashboard caches on success.
 */
export function useUpdateLessonDetails() {
  return useMutation<
    LessonResponse,
    Error,
    { id: string; data: UpdateLessonRequest }
  >({
    mutationFn: ({ id, data }) => updateLessonRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
