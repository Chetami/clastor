import { useMutation } from "@tanstack/react-query";
import { createFeedbackRequest } from "./requests";
import type { FeedbackResponse } from "@examify-tms/interfaces";

export function useCreateFeedback() {
  return useMutation<
    FeedbackResponse,
    Error,
    {
      type: string;
      message: string;
      pageUrl: string;
      images: File[];
    }
  >({
    mutationFn: (params) => createFeedbackRequest(params),
  });
}
