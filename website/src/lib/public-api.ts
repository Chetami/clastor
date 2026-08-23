import type {
  CreateTutorReviewRequest,
  PublicTutorListResponse,
  PublicTutorProfileResponse,
  PublicTutorReviewListResponse,
  TutorReview,
} from "@examify-tms/interfaces";

/**
 * Fetchers for the backend's public tutor endpoints. Mirrors the data layer
 * in @examify-tms/shared but with plain fetch — the marketing site stays
 * dependency-light (no axios / react-query) like the contact form.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/** Filters accepted by GET /api/tutor-profiles/directory. */
export interface PublicTutorsQuery {
  search?: string;
  subject?: string;
  online?: boolean;
  maxRate?: number;
  sort?: "recent" | "rating";
  limit?: number;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getPublicProfile(slug: string): Promise<PublicTutorProfileResponse> {
  return getJson(`/api/tutor-profiles/public/${encodeURIComponent(slug)}`);
}

export function listPublicTutors(
  query: PublicTutorsQuery = {},
): Promise<PublicTutorListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.subject) params.set("subject", query.subject);
  if (query.online) params.set("online", "true");
  if (query.maxRate != null) params.set("maxRate", String(query.maxRate));
  if (query.sort) params.set("sort", query.sort);
  if (query.limit != null) params.set("limit", String(query.limit));
  const qs = params.toString();
  return getJson(`/api/tutor-profiles/directory${qs ? `?${qs}` : ""}`);
}

export function listPublicReviews(
  slug: string,
): Promise<PublicTutorReviewListResponse> {
  return getJson(
    `/api/tutor-profiles/public/${encodeURIComponent(slug)}/reviews`,
  );
}

export async function createPublicReview(
  slug: string,
  data: CreateTutorReviewRequest,
): Promise<TutorReview> {
  const response = await fetch(
    `${API_BASE_URL}/api/tutor-profiles/public/${encodeURIComponent(slug)}/reviews`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? "Failed to submit review.");
  }
  return response.json() as Promise<TutorReview>;
}
