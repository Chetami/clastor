import { api } from "@/lib/api";
import type {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  MarkPaidRequest,
  InvoiceResponse,
  InvoiceListResponse,
  InvoiceStatus,
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
