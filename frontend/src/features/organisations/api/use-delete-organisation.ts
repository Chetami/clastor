import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteOrganisationRequest } from "./requests";

/**
 * Soft-delete (archive) an organisation. If the deleted org was the active one,
 * callers should switch back to personal mode afterwards (handled in the UI).
 */
export function useDeleteOrganisation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => deleteOrganisationRequest(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
  });
}
