import { useMutation } from "@tanstack/react-query";
import { completeOnboardingRequest } from "./requests";
import { useAuthStore } from "../../../store/auth-store";

/**
 * Mark onboarding complete and push the updated user into the auth store so
 * the dashboard banner disappears immediately.
 */
export function useCompleteOnboarding() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: completeOnboardingRequest,
    onSuccess: (user) => setUser(user),
  });
}
