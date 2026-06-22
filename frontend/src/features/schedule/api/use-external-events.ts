import { useQuery } from "@tanstack/react-query";
import { getExternalCalendarEventsRequest } from "./requests";
import type { ExternalCalendarEvent } from "@examify-tms/interfaces";

/**
 * Fetch external (non-lesson) Google Calendar events for the visible window.
 * Disabled until a window (from/to) is provided. The query key includes the
 * window so navigating weeks refetches. Enabled only when Google is connected.
 */
export function useExternalCalendarEvents(
  window: { from: string; to: string } | null,
  enabled: boolean,
) {
  return useQuery<ExternalCalendarEvent[]>({
    queryKey: ["external-events", window?.from, window?.to],
    queryFn: async () => {
      if (!window) return [];
      const response = await getExternalCalendarEventsRequest(window);
      return response.data;
    },
    enabled: !!window && enabled,
    staleTime: 60 * 1000,
  });
}
