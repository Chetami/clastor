import { api } from "../../../lib/api";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";

export async function getPublicProfileRequest(
  slug: string,
): Promise<PublicTutorProfileResponse> {
  const response = await api.get<PublicTutorProfileResponse>(
    `/api/tutor-profiles/public/${encodeURIComponent(slug)}`,
  );
  return response.data;
}
