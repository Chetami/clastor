import { useMutation } from "@tanstack/react-query";
import { updateStudentRequest } from "./requests";
import type { UpdateStudentRequest, StudentResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useUpdateStudent() {
  return useMutation<StudentResponse, Error, { id: string; data: UpdateStudentRequest }>({
    mutationFn: ({ id, data }) => updateStudentRequest(id, data),
    onSuccess: (_, variables) => {
      // Invalidate both the students list and the specific student query
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students", variables.id] });
    },
  });
}