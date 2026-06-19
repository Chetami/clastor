import { useAuthStore } from "@/store/auth-store";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return {
    user,
    token,
    setAuth,
    clearAuth,
    isAuthenticated: !!user,
  };
}
