import { useMutation } from "@tanstack/react-query";
import { googleSignInRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

export function useGoogleSignIn() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: () => googleSignInRequest(),
    onSuccess: (data) => {
      setAuth(data.user, data.jwtToken);
    },
  });
}
