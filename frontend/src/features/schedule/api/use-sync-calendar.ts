import { useMutation } from "@tanstack/react-query";
import { syncCalendarRequest } from "./requests";
import { queryClient } from "@/lib/query-client";

/**
 * Manually backfill all upcoming lessons to Google Calendar. On success,
 * invalidate lessons + external events so sync status / overlays refresh.
 */
export function useSyncCalendar() {
  return useMutation<{ pushed: number; skipped: number }, Error, void>({
    mutationFn: () => syncCalendarRequest(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["external-events"] });
    },
  });
}
