import { useMutation } from "@tanstack/react-query";
import { markTourSeenRequest } from "./requests";
import { useAuthStore } from "@/store/auth-store";

/**
 * Mark the product tour as seen and push the updated user into the auth store
 * so TourBoot stops trying to auto-run it.
 */
export function useMarkTourSeen() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: markTourSeenRequest,
    onSuccess: (user) => setUser(user),
  });
}
