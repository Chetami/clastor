import { useMutation } from "@tanstack/react-query";
import { loginRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.jwtToken);
    },
  });
}
