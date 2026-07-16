import { useMutation } from "@tanstack/react-query";
import { publishProfileRequest, unpublishProfileRequest } from "./requests";
import type { TutorProfileResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function usePublishTutorProfile() {
  return useMutation<TutorProfileResponse, Error, void>({
    mutationFn: () => publishProfileRequest(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-profile", "me"] });
    },
  });
}

export function useUnpublishTutorProfile() {
  return useMutation<TutorProfileResponse, Error, void>({
    mutationFn: () => unpublishProfileRequest(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-profile", "me"] });
    },
  });
}
