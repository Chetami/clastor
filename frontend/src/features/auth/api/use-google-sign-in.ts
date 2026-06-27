import { useMutation } from "@tanstack/react-query";
import { googleSignInRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";

export function useGoogleSignIn() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: () => googleSignInRequest(),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}
