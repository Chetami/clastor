import { useQuery } from "@tanstack/react-query";
import { listSentEmailsRequest, type ListSentEmailsParams } from "./requests";

/**
 * List sent-email records, optionally scoped to one entity.
 *
 * - **Scoped** (pass `lessonId` / `invoiceId` / `studentId`): used by the
 *   `EmailHistory` panels on detail pages. The query key encodes the scope so
 *   each panel caches independently.
 * - **Unscoped** (no params): used by the Sent Emails sidebar page. The
 *   backend auto-scopes tutors to their own emails and returns the global
 *   recent list for system admins.
 */
export function useListSentEmails(params: ListSentEmailsParams = {}) {
  const scopeKey = params.lessonId
    ? ["lesson", params.lessonId]
    : params.invoiceId
      ? ["invoice", params.invoiceId]
      : params.studentId
        ? ["student", params.studentId]
        : ["all"];

  return useQuery({
    queryKey: ["sent-emails", scopeKey],
    queryFn: () => listSentEmailsRequest(params),
  });
}
