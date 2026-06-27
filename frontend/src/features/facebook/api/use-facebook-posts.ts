import { useMutation } from "@tanstack/react-query";
import { publishFacebookPostRequest } from "./requests";
import type { PublishFacebookPostRequest } from "@examify-tms/interfaces";

/**
 * Publish a post to the tutor's connected Facebook Page.
 */
export function usePublishFacebookPost() {
  return useMutation({
    mutationFn: (data: PublishFacebookPostRequest) =>
      publishFacebookPostRequest(data),
  });
}
