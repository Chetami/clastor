import { api } from "../../../lib/api";
import type {
  CreateTutorReviewRequest,
  PublicTutorListResponse,
  PublicTutorProfileResponse,
  PublicTutorReviewListResponse,
  TutorReview,
} from "@examify-tms/interfaces";

export interface PublicTutorsQuery {
  search?: string;
  subject?: string;
  online?: boolean;
  maxRate?: number;
  sort?: "recent" | "rating";
  limit?: number;
}

export async function getPublicProfileRequest(
  slug: string,
): Promise<PublicTutorProfileResponse> {
  const response = await api.get<PublicTutorProfileResponse>(
    `/api/tutor-profiles/public/${encodeURIComponent(slug)}`,
  );
  return response.data;
}

export async function listPublicTutorsRequest(
  query: PublicTutorsQuery = {},
): Promise<PublicTutorListResponse> {
  const response = await api.get<PublicTutorListResponse>(
    "/api/tutor-profiles/directory",
    { params: query },
  );
  return response.data;
}

export async function listPublicReviewsRequest(
  slug: string,
): Promise<PublicTutorReviewListResponse> {
  const response = await api.get<PublicTutorReviewListResponse>(
    `/api/tutor-profiles/public/${encodeURIComponent(slug)}/reviews`,
  );
  return response.data;
}

export async function createPublicReviewRequest(
  slug: string,
  data: CreateTutorReviewRequest,
): Promise<TutorReview> {
  const response = await api.post<TutorReview>(
    `/api/tutor-profiles/public/${encodeURIComponent(slug)}/reviews`,
    data,
  );
  return response.data;
}
