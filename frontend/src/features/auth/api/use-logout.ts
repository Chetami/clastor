import { useMutation } from "@tanstack/react-query";
import { logoutRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      clearAuth();
    },
  });
}
