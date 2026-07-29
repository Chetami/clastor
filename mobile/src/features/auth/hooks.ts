import { useMutation } from "@tanstack/react-query";
import { useAuthStore, queryClient } from "@examify-tms/shared";
import { loginRequest, logoutRequest } from "./requests";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      // Drop any data cached from a previous session before establishing the
      // new identity.
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useMutation({
    mutationFn: () => logoutRequest(refreshToken),
    onSettled: () => {
      queryClient.clear();
      clearAuth();
    },
  });
}
