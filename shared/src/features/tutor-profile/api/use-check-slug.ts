import { useQuery } from "@tanstack/react-query";
import { checkSlugRequest } from "./requests";

/**
 * Live slug availability check. Disabled while the input is empty or shorter
 * than the minimum, and skipped for the tutor's current slug (always "available"
 * to themselves). Debounced via React Query's placeholderData + staleTime.
 */
export function useCheckSlug(slug: string, currentSlug: string | undefined) {
  const normalized = slug.trim().toLowerCase();
  const enabled = normalized.length >= 3 && normalized !== currentSlug;

  return useQuery({
    queryKey: ["tutor-profile", "check-slug", normalized],
    queryFn: () => checkSlugRequest(normalized),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}
