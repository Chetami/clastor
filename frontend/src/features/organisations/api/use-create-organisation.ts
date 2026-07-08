import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrganisationRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import type { CreateOrganisationRequest } from "@examify-tms/interfaces";

/**
 * Create an organisation. The backend makes the caller the first org_admin AND
 * auto-switches them into it, returning a re-issued access token. We apply that
 * new session immediately and refetch scope-dependent data.
 */
export function useCreateOrganisation() {
  const queryClient = useQueryClient();
  const switchSession = useAuthStore((s) => s.switchSession);

  return useMutation({
    mutationFn: (data: CreateOrganisationRequest) =>
      createOrganisationRequest(data),
    onSuccess: ({ user, token }) => {
      switchSession(user, token);
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
