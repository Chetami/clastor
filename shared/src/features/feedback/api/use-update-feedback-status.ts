import { useMutation } from "@tanstack/react-query";
import { updateFeedbackStatusRequest } from "./requests";
import type {
  FeedbackResponse,
  UpdateFeedbackStatusRequest,
} from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useUpdateFeedbackStatus() {
  return useMutation<
    FeedbackResponse,
    Error,
    { id: string; status: UpdateFeedbackStatusRequest["status"] }
  >({
    mutationFn: ({ id, status }) =>
      updateFeedbackStatusRequest(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
}
