import { api } from "@/lib/api";
import type { Subject, UserInfo } from "@examify-tms/interfaces";

/**
 * Replace the tutor's subject catalogue. This is a full replacement: send the
 * complete desired array. The backend normalizes/validates and cascades
 * deletions off tagged students. Returns the updated UserInfo (with the new
 * `subjects` array).
 */
export async function updateSubjectsRequest(
  subjects: Subject[],
): Promise<UserInfo> {
  const response = await api.patch<UserInfo>("/api/users/me", { subjects });
  return response.data;
}
