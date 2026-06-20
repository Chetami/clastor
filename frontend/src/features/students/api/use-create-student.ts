import { useMutation } from "@tanstack/react-query";
import { createStudentRequest } from "./requests";
import type { CreateStudentRequest, StudentResponse } from "@examify-tms/interfaces";

export function useCreateStudent() {
  return useMutation<StudentResponse, Error, CreateStudentRequest>({
    mutationFn: (data: CreateStudentRequest) => createStudentRequest(data),
  });
}
