import { useMutation } from "@tanstack/react-query";
import { publishFacebookPostRequest, type PublishPostPayload } from "./requests";

/**
 * Publish a post to the tutor's connected Facebook Page. Accepts image URLs
 * and/or uploaded files; the request shape is chosen by the request layer.
 */
export function usePublishFacebookPost() {
  return useMutation({
    mutationFn: (data: PublishPostPayload) => publishFacebookPostRequest(data),
  });
}
