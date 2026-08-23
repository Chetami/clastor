import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTutorReviewRequest, PublicTutorSummary } from "@examify-tms/interfaces";
import {
  createPublicReviewRequest,
  listPublicReviewsRequest,
  listPublicTutorsRequest,
  type PublicTutorsQuery,
} from "./requests";

/**
 * Public tutor directory. Filters double as the query key so each filter
 * combination caches independently; placeholderData keeps cards mounted
 * while a new filter combination loads.
 */
export function usePublicTutors(query: PublicTutorsQuery = {}) {
  return useQuery({
    queryKey: ["public-tutors", query],
    queryFn: () => listPublicTutorsRequest(query),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

/** Approved reviews shown on a tutor's public page. */
export function usePublicReviews(slug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["public-tutor-reviews", slug],
    queryFn: () => listPublicReviewsRequest(slug!),
    enabled: !!slug && enabled,
  });
}

/** Public review submission (starts pending moderation). */
export function useCreatePublicReview(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTutorReviewRequest) =>
      createPublicReviewRequest(slug!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["public-tutor-reviews", slug],
      });
    },
  });
}

/** Type re-export so directory UIs can annotate without importing interfaces. */
export type { PublicTutorSummary };
