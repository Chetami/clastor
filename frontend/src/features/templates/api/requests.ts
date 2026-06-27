import { api } from "@/lib/api";
import type {
  TemplateSummary,
  EmailTemplatePreview,
} from "@examify-tms/interfaces";

export async function listTemplatesRequest(): Promise<TemplateSummary[]> {
  const response = await api.get<TemplateSummary[]>("/api/templates");
  return response.data;
}

export async function getEmailTemplatePreviewRequest(
  id: string,
): Promise<EmailTemplatePreview> {
  const response = await api.get<EmailTemplatePreview>(
    `/api/templates/${id}/preview`,
  );
  return response.data;
}

/**
 * Fetch the invoice template preview as a PDF blob (authenticated via the
 * bearer interceptor). The caller turns it into an object URL to embed.
 */
export async function getInvoiceTemplatePreviewRequest(): Promise<Blob> {
  const response = await api.get<Blob>("/api/templates/invoice/preview", {
    responseType: "blob",
  });
  return response.data;
}
