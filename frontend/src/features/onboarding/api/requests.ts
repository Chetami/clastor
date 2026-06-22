import { api } from "@/lib/api";
import type { UserInfo } from "@examify-tms/interfaces";

/**
 * Mark the authenticated user's onboarding as finished. The user may have
 * completed every step or just dismissed the wizard; either way we stop
 * nudging them. Returns the updated UserInfo.
 */
export async function completeOnboardingRequest(): Promise<UserInfo> {
  const response = await api.patch<UserInfo>("/api/users/me", {
    onboardingComplete: true,
  });
  return response.data;
}
