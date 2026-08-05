import { api } from "../../../lib/api";
import type {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  MarkPaidRequest,
  InvoiceResponse,
  InvoiceListResponse,
  InvoiceEventListResponse,
  InvoiceStatus,
  EmailPreviewResponse,
} from "@examify-tms/interfaces";

export interface ListInvoicesParams {
  status?: InvoiceStatus | "all";
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export async function listInvoicesRequest(
  params?: ListInvoicesParams,
): Promise<InvoiceListResponse> {
  const response = await api.get<InvoiceListResponse>("/api/payments", {
    params,
  });
  return response.data;
}

export async function getInvoiceRequest(id: string): Promise<InvoiceResponse> {
  const response = await api.get<InvoiceResponse>(`/api/payments/${id}`);
  return response.data;
}

export async function createInvoiceRequest(
  data: CreateInvoiceRequest,
): Promise<InvoiceResponse> {
  const response = await api.post<InvoiceResponse>("/api/payments", data);
  return response.data;
}

export async function updateInvoiceRequest(
  id: string,
  data: UpdateInvoiceRequest,
): Promise<InvoiceResponse> {
  const response = await api.patch<InvoiceResponse>(`/api/payments/${id}`, data);
  return response.data;
}

export async function sendInvoiceRequest(
  id: string,
  message?: string,
): Promise<InvoiceResponse> {
  const response = await api.post<InvoiceResponse>(
    `/api/payments/${id}/send`,
    { message: message ?? null },
  );
  return response.data;
}

/**
 * Preview (without sending) the invoice email so the tutor can review and edit
 * the message before sending. Does not promote a draft or stamp sentAt.
 */
export async function previewSendInvoiceRequest(
  id: string,
  message?: string,
): Promise<EmailPreviewResponse> {
  const response = await api.post<EmailPreviewResponse>(
    `/api/payments/${id}/send/preview`,
    {
      message: message ?? null,
    },
  );
  return response.data;
}

/**
 * Fetch the invoice PDF as a blob (authenticated via the bearer interceptor,
 * so a plain navigation URL won't work). Caller opens an object URL for
 * printing / download.
 */
export async function getInvoicePdfRequest(id: string): Promise<Blob> {
  const response = await api.get<Blob>(`/api/payments/${id}/pdf`, {
    responseType: "blob",
  });
  return response.data;
}

export async function markInvoicePaidRequest(
  id: string,
  data?: MarkPaidRequest,
): Promise<InvoiceResponse> {
  const response = await api.post<InvoiceResponse>(
    `/api/payments/${id}/mark-paid`,
    data ?? {},
  );
  return response.data;
}

export async function voidInvoiceRequest(
  id: string,
): Promise<InvoiceResponse> {
  const response = await api.post<InvoiceResponse>(`/api/payments/${id}/void`);
  return response.data;
}

export async function deleteInvoiceRequest(
  id: string,
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/api/payments/${id}`);
  return response.data;
}

export async function listInvoiceEventsRequest(
  id: string,
): Promise<InvoiceEventListResponse> {
  const response = await api.get<InvoiceEventListResponse>(
    `/api/payments/${id}/events`,
  );
  return response.data;
}
