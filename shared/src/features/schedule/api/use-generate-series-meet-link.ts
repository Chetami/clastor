import { useMutation } from "@tanstack/react-query";
import { generateSeriesMeetLinkRequest } from "./requests";
import type { GenerateSeriesMeetLinkResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

/**
 * Generate one shared Google Meet link for a series and apply it to every
 * upcoming lesson. On success, refresh lessons (incl. the series + its
 * occurrences) and external calendar events so the new Meet link and
 * calendar conferences are reflected.
 */
export function useGenerateSeriesMeetLink(seriesId: string) {
  return useMutation<GenerateSeriesMeetLinkResponse, Error, void>({
    mutationFn: () => generateSeriesMeetLinkRequest(seriesId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["external-events"] });
    },
  });
}
