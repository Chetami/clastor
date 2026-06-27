import { api } from "@/lib/api";
import type {
  FeedbackResponse,
  FeedbackListResponse,
  UpdateFeedbackStatusRequest,
} from "@examify-tms/interfaces";

export async function listFeedbackRequest(): Promise<FeedbackListResponse> {
  const response = await api.get<FeedbackListResponse>("/api/feedback");
  return response.data;
}

export async function createFeedbackRequest(params: {
  type: string;
  message: string;
  pageUrl: string;
  images: File[];
}): Promise<FeedbackResponse> {
  const form = new FormData();
  form.append("type", params.type);
  form.append("message", params.message);
  form.append("pageUrl", params.pageUrl);
  for (const image of params.images) {
    form.append("images", image);
  }
  const response = await api.post<FeedbackResponse>("/api/feedback", form, {
    headers: { "Content-Type": undefined },
  });
  return response.data;
}

export async function updateFeedbackStatusRequest(
  id: string,
  data: UpdateFeedbackStatusRequest,
): Promise<FeedbackResponse> {
  const response = await api.patch<FeedbackResponse>(
    `/api/feedback/${id}/status`,
    data,
  );
  return response.data;
}
