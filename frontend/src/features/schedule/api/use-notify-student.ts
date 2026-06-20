import { useMutation } from "@tanstack/react-query";
import { notifyStudentRequest } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useNotifyStudent(id: string) {
  return useMutation<LessonResponse, Error, string | undefined>({
    mutationFn: (message?: string) => notifyStudentRequest(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
