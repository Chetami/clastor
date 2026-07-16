import { useMutation } from "@tanstack/react-query";
import { queryClient, useAuthStore } from "@examify-tms/shared";
import {
  loginRequest,
  registerRequest,
  logoutRequest,
  googleSignInRequest,
} from "./requests";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.user, data.jwtToken, data.refreshToken);
    },
  });
}

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

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      return logoutRequest(refreshToken);
    },
    onSettled: () => {
      queryClient.clear();
      clearAuth();
    },
  });
}
