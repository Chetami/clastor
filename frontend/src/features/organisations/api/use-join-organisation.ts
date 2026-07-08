import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinOrganisationRequest } from "./requests";
import type { JoinOrganisationRequest } from "@examify-tms/interfaces";

/** Join an org by code. Adds membership only — does not auto-switch active org. */
export function useJoinOrganisation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JoinOrganisationRequest) => joinOrganisationRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
  });
}
