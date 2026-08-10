import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import type { SignupSurvey } from "@examify-tms/interfaces";

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({
      name,
      email,
      password,
      signupSurvey,
    }: {
      name: string;
      email: string;
      password: string;
      signupSurvey?: SignupSurvey;
    }) => registerRequest(name, email, password, signupSurvey),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}
