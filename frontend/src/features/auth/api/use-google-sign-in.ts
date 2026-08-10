import { useMutation } from "@tanstack/react-query";
import { googleSignInRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import type { SignupSurvey } from "@examify-tms/interfaces";

export function useGoogleSignIn() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (signupSurvey?: SignupSurvey) =>
      googleSignInRequest(signupSurvey),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}
