import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TutorReview } from "@examify-tms/interfaces";
import { moderateReviewRequest } from "./requests";

/**
 * Approve or reject a review about the authenticated tutor. Invalidates the
 * review list (and the profile, whose rating aggregates change on approve).
 */
export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation<TutorReview, Error, { reviewId: string; action: "approve" | "reject" }>({
    mutationFn: ({ reviewId, action }) => moderateReviewRequest(reviewId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-profile", "me-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["tutor-profile", "me"] });
    },
  });
}
