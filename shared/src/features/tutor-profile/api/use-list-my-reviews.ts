import { useQuery } from "@tanstack/react-query";
import { listMyReviewsRequest } from "./requests";

/** Every review about the authenticated tutor, all moderation statuses. */
export function useListMyReviews() {
  return useQuery({
    queryKey: ["tutor-profile", "me-reviews"],
    queryFn: () => listMyReviewsRequest(),
  });
}
