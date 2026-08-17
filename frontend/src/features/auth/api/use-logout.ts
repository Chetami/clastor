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
      return logoutRequest(refreshToken);
    },
    onSettled: () => {
      // Track while the identity is still active — clearAuth triggers the
      // PostHog reset in AnalyticsIdentitySync.
      track("logout");
      // Drop all cached query data so the next user doesn't see the
      // previous user's students/lessons until the app is refreshed.
      queryClient.clear();
      clearAuth();
    },
  });
}
