import { api } from "@/lib/api";
import type { UserInfo } from "@examify-tms/interfaces";

/**
 * Mark the in-app product tour as seen (completed or skipped). Stops the tour
 * from auto-running again on the next dashboard visit. Returns the updated
 * UserInfo.
 */
export async function markTourSeenRequest(): Promise<UserInfo> {
  const response = await api.patch<UserInfo>("/api/users/me", {
    tourSeen: true,
  });
  return response.data;
}
