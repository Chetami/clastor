import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => registerRequest(name, email, password),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}
