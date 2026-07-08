import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganisationRequest } from "./requests";
import type { UpdateOrganisationRequest } from "@examify-tms/interfaces";

export function useUpdateOrganisation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOrganisationRequest) =>
      updateOrganisationRequest(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
  });
}
