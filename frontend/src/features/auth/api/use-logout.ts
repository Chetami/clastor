import { useMutation } from "@tanstack/react-query";
import { logoutRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import { track } from "@/lib/analytics";

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      track("logout");
      // Advance the session generation immediately so an in-flight refresh
      // cannot restore credentials while server-side revocation is pending.
      clearAuth();
      queryClient.clear();
      return logoutRequest(refreshToken);
    },
  });
}
