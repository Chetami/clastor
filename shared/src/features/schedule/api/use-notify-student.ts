import { useMutation } from "@tanstack/react-query";
import { notifyStudentRequest } from "./requests";
import type { LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export interface NotifyStudentArgs {
  message?: string;
}

export function useNotifyStudent(id: string) {
  return useMutation<LessonResponse, Error, NotifyStudentArgs | void>({
    mutationFn: (args) => notifyStudentRequest(id, args?.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
      // Refresh the sent-email history panels scoped to this lesson.
      queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
    },
  });
}
