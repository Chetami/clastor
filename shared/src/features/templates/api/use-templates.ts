import { useQuery } from "@tanstack/react-query";
import {
  listTemplatesRequest,
  getEmailTemplatePreviewRequest,
  getInvoiceTemplatePreviewRequest,
} from "./requests";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: listTemplatesRequest,
    staleTime: Infinity,
  });
}

/**
 * Preview an email-based template (lesson-reminder / meet-invite). Only
 * enabled when the selected template id is an email template.
 */
export function useEmailTemplatePreview(
  id: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["templates", id, "preview"],
    queryFn: () => {
      if (!id) throw new Error("Template id is required");
      return getEmailTemplatePreviewRequest(id);
    },
    enabled: enabled && !!id,
    staleTime: Infinity,
  });
}

/**
 * Preview the invoice template as a PDF blob. Only enabled when the invoice
 * template is selected.
 */
export function useInvoiceTemplatePreview(enabled: boolean) {
  return useQuery({
    queryKey: ["templates", "invoice", "preview"],
    queryFn: getInvoiceTemplatePreviewRequest,
    enabled,
    staleTime: Infinity,
  });
}
