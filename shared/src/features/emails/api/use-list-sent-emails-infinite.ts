import { useInfiniteQuery } from "@tanstack/react-query";
import { listSentEmailsRequest, type ListSentEmailsParams } from "./requests";
import type { SentEmailListResponse } from "@examify-tms/interfaces";

/**
 * Cursor-paginated, "load more"-style sent-emails query for the Sent Emails
 * page.
 *
 * Each page request returns up to `pageSize` emails plus an opaque
 * `nextCursor`; `fetchNextPage` advances to the next page and the results
 * accumulate across pages in `data.pages`. The backend reads only ~`pageSize`
 * documents per page.
 *
 * Admins may pass a `tutorId` drill-down; changing it starts over at page 1.
 */
export function useListSentEmailsInfinite(
  params: Pick<ListSentEmailsParams, "tutorId"> = {},
  pageSize = 20,
) {
  return useInfiniteQuery({
    queryKey: ["sent-emails", "infinite", params.tutorId ?? "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listSentEmailsRequest({
        ...params,
        limit: pageSize,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage: SentEmailListResponse) =>
      lastPage.nextCursor ?? undefined,
  });
}
