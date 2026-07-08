import { useMutation, useQueryClient } from "@tanstack/react-query";
import { switchActiveOrgRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

/**
 * Switch the active organisation (null = personal mode). The backend re-issues
 * the access JWT with the new currentOrgId baked in; we apply that session and
 * refetch scope-dependent data (students this milestone; lessons/invoices later).
 */
export function useSwitchActiveOrg() {
  const queryClient = useQueryClient();
  const switchSession = useAuthStore((s) => s.switchSession);

  return useMutation({
    mutationFn: (organisationId: string | null) =>
      switchActiveOrgRequest(organisationId),
    onSuccess: ({ user, token }) => {
      switchSession(user, token);
      // Scope-dependent caches: anything filtered by currentOrgId must refetch.
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
