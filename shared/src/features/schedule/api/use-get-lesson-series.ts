import { useQuery } from "@tanstack/react-query";
import { getLessonSeriesRequest } from "./requests";

/**
 * Fetch a lesson series (metadata) by ID. Occurrences are fetched
 * separately via `useListLessons({ seriesId })`.
 */
export function useGetLessonSeries(seriesId: string | undefined) {
  return useQuery({
    queryKey: ["lessons", "series", seriesId],
    queryFn: () => getLessonSeriesRequest(seriesId!),
    enabled: !!seriesId,
  });
}

export interface PollSeriesMeetLinkOptions {
  /** Milliseconds between attempts. Defaults to 2500. */
  intervalMs?: number;
  /** Max number of attempts before giving up. Defaults to 12 (~30s). */
  maxAttempts?: number;
}

/**
 * Poll a series until its background-provisioned Meet link appears (or the
 * attempt budget is exhausted). The Meet link is generated asynchronously
 * after a series is created, so callers fire-and-forget this and surface
 * completion via toasts/UI. Resolves with the link, or `null` on timeout.
 */
export async function pollSeriesMeetLink(
  seriesId: string,
  options: PollSeriesMeetLinkOptions = {},
): Promise<string | null> {
  const intervalMs = options.intervalMs ?? 2500;
  const maxAttempts = options.maxAttempts ?? 12;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    try {
      const series = await getLessonSeriesRequest(seriesId);
      if (series.meetLink) return series.meetLink;
    } catch {
      // Transient errors are fine — keep polling.
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
