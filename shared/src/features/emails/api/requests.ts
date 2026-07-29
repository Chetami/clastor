import { api } from "../../../lib/api";
import type {
  SentEmailResponse,
  SentEmailListResponse,
} from "@examify-tms/interfaces";

export interface ListSentEmailsParams {
  lessonId?: string;
  invoiceId?: string;
  studentId?: string;
}

export async function listSentEmailsRequest(
  params: ListSentEmailsParams = {},
): Promise<SentEmailListResponse> {
  const response = await api.get<SentEmailListResponse>("/api/sent-emails", {
    params,
  });
  return response.data;
}

export async function getSentEmailRequest(
  id: string,
): Promise<SentEmailResponse> {
  const response = await api.get<SentEmailResponse>(`/api/sent-emails/${id}`);
  return response.data;
}
