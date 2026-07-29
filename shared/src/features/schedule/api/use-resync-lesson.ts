import { useMutation } from "@tanstack/react-query";
import { resyncLessonRequest, type ResyncLessonAction } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

/**
 * Force-resync a single lesson to Google Calendar (creates/patches/recreates
 * the backing event). On success, refresh lessons + external events so the
 * schedule and sync status reflect the change.
 */
export function useResyncLesson(id: string) {
  return useMutation<
    { lesson: LessonResponse; action: ResyncLessonAction },
    Error,
    void
  >({
    mutationFn: () => resyncLessonRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["external-events"] });
    },
  });
}
