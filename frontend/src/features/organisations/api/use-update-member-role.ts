import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemberRoleRequest } from "./requests";
import type { OrgMemberRole } from "@examify-tms/interfaces";

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgMemberRole }) =>
      updateMemberRoleRequest(orgId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organisations", orgId, "members"],
      });
    },
  });
}
