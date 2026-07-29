import { useQuery } from "@tanstack/react-query";
import { getLessonRequest } from "./requests";

export function useGetLesson(id: string | undefined) {
  return useQuery({
    queryKey: ["lessons", id],
    queryFn: () => getLessonRequest(id!),
    enabled: !!id,
  });
}
