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
 * - **Tutor filter** (pass `tutorId`): system_admin-only server-side drill;
 *   tutors are always scoped to their own uid regardless.
 */
export function useListSentEmails(params: ListSentEmailsParams = {}) {
  return useQuery({
    // Key on the whole params object (consistent with ["lessons", params] /
    // ["invoices", params]) — keying on just the first matching scope field
    // would collide different filter combinations on one cache entry.
    queryKey: ["sent-emails", params],
    queryFn: () => listSentEmailsRequest(params),
  });
}
