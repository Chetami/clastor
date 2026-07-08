import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMemberRequest } from "./requests";

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMemberRequest(orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organisations", orgId, "members"],
      });
    },
  });
}
