import { useMutation, useQueryClient } from "@tanstack/react-query";
import { regenerateJoinCodeRequest } from "./requests";

export function useRegenerateJoinCode(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateJoinCodeRequest(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organisations", orgId] });
    },
  });
}
