import { useMutation } from "@tanstack/react-query";
import { loginRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      // Clear any data left over from a previous session before establishing
      // the new identity, so no other user's data is ever shown.
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}
