import { useMutation } from "@tanstack/react-query";
import { importStudentsRequest } from "./requests";
import type { StudentImportSummary } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useImportStudents() {
  return useMutation<StudentImportSummary, Error, File>({
    mutationFn: (file: File) => importStudentsRequest(file),
    onSuccess: () => {
      // Invalidate the students list query so newly imported rows appear.
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
