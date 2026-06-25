import { useInfiniteQuery } from "@tanstack/react-query";
import { listLessonsRequest, type ListLessonsParams } from "./requests";
import type { LessonListResponse } from "@examify-tms/interfaces";

/**
 * Cursor-paginated, "load more"-style lessons query for the lessons page.
 *
 * Each page request returns up to `pageSize` lessons plus an opaque
 * `nextCursor`; `fetchNextPage` advances to the next page and the results
 * accumulate across pages in `data.pages`. The query reads only ~`pageSize`
 * documents per page on the backend.
 *
 * Pass a stable `status` (the active tab); changing it starts over at page 1.
 */
export function useListLessonsInfinite(
  params: { status: ListLessonsParams["status"] },
  pageSize = 10,
) {
  return useInfiniteQuery({
    queryKey: ["lessons", "infinite", params.status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listLessonsRequest({
        status: params.status,
        limit: pageSize,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage: LessonListResponse) =>
      lastPage.nextCursor ?? undefined,
  });
}
