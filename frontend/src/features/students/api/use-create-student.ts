import { useMutation } from "@tanstack/react-query";
import { createStudentRequest } from "./requests";
import type { CreateStudentRequest, StudentResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useCreateStudent() {
  return useMutation<StudentResponse, Error, CreateStudentRequest>({
    mutationFn: (data: CreateStudentRequest) => createStudentRequest(data),
    onSuccess: () => {
      // Invalidate the students list query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
