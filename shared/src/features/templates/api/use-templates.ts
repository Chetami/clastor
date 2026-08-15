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
 * enabled when the selected template id is an email template. Previews are
 * NOT cached forever (unlike the static template list): they render the
 * tutor's live Settings (invoice details, review preferences), so they must
 * refetch to reflect changes.
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
  });
}

/**
 * Preview the invoice template as a PDF blob. Only enabled when the invoice
 * template is selected. Reflects the tutor's invoice Settings, so it refetches
 * on mount rather than being cached forever.
 */
export function useInvoiceTemplatePreview(enabled: boolean) {
  return useQuery({
    queryKey: ["templates", "invoice", "preview"],
    queryFn: getInvoiceTemplatePreviewRequest,
    enabled,
  });
}
