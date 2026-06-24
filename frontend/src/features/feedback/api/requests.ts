import { api } from "@/lib/api";
import type { FeedbackResponse } from "@examify-tms/interfaces";

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
