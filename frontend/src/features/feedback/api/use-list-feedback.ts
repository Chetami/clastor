import { useQuery } from "@tanstack/react-query";
import { listFeedbackRequest } from "./requests";
import type { FeedbackResponse } from "@examify-tms/interfaces";

export function useListFeedback() {
  return useQuery<FeedbackResponse[]>({
    queryKey: ["feedback"],
    queryFn: async () => {
      const response = await listFeedbackRequest();
      return response.data;
    },
  });
}
