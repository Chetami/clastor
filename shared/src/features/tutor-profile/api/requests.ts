import { api } from "../../../lib/api";
import type {
  UpdateTutorProfileRequest,
  TutorProfileResponse,
  CheckSlugResponse,
  TutorReview,
  TutorReviewListResponse,
} from "@examify-tms/interfaces";

export async function getMyProfileRequest(): Promise<TutorProfileResponse | null> {
  const response = await api.get<TutorProfileResponse>(
    "/api/tutor-profiles/me",
    { validateStatus: (s) => s === 200 || s === 404 },
  );
  if (response.status === 404) return null;
  return response.data;
}

export async function updateMyProfileRequest(
  data: UpdateTutorProfileRequest,
): Promise<TutorProfileResponse> {
  const response = await api.put<TutorProfileResponse>(
    "/api/tutor-profiles/me",
    data,
  );
  return response.data;
}

export async function publishProfileRequest(): Promise<TutorProfileResponse> {
  const response = await api.post<TutorProfileResponse>(
    "/api/tutor-profiles/me/publish",
  );
  return response.data;
}

export async function unpublishProfileRequest(): Promise<TutorProfileResponse> {
  const response = await api.post<TutorProfileResponse>(
    "/api/tutor-profiles/me/unpublish",
  );
  return response.data;
}

export async function checkSlugRequest(
  slug: string,
): Promise<CheckSlugResponse> {
  const response = await api.get<CheckSlugResponse>(
    "/api/tutor-profiles/check-slug",
    { params: { slug } },
  );
  return response.data;
}

export async function listMyReviewsRequest(): Promise<TutorReviewListResponse> {
  const response = await api.get<TutorReviewListResponse>(
    "/api/tutor-profiles/me/reviews",
  );
  return response.data;
}

export async function moderateReviewRequest(
  reviewId: string,
  action: "approve" | "reject",
): Promise<TutorReview> {
  const response = await api.post<TutorReview>(
    `/api/tutor-profiles/me/reviews/${encodeURIComponent(reviewId)}/${action}`,
  );
  return response.data;
}
