import { useMutation } from "@tanstack/react-query";
import { updateMyProfileRequest } from "./requests";
import type {
  UpdateTutorProfileRequest,
  TutorProfileResponse,
} from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useUpdateTutorProfile() {
  return useMutation<TutorProfileResponse, Error, UpdateTutorProfileRequest>({
    mutationFn: (data) => updateMyProfileRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-profile", "me"] });
    },
  });
}
