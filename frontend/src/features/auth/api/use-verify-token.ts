import { useQuery } from "@tanstack/react-query";
import { verifyRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

export function useVerifyToken() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ["auth", "verify"],
    queryFn: async () => {
      const user = await verifyRequest();
      setUser(user);
      return user;
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}
