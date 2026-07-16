import { useMutation } from "@tanstack/react-query";
import { syncCalendarRequest } from "./requests";
import { queryClient } from "../../../lib/query-client";

/**
 * Manually reconcile all upcoming lessons with Google Calendar: pushes
 * un-synced lessons AND recreates events that were deleted on Google's side.
 * On success, invalidate lessons + external events so sync status / overlays
 * refresh.
 */
export function useSyncCalendar() {
  return useMutation<
    { pushed: number; recovered: number; skipped: number },
    Error,
    void
  >({
    mutationFn: () => syncCalendarRequest(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["external-events"] });
    },
  });
}
