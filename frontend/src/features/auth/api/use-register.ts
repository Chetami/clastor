import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

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
      setAuth(data.user, data.jwtToken);
    },
  });
}
