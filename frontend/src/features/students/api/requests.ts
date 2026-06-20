import { api } from "@/lib/api";
import type {
  CreateStudentRequest,
  StudentListResponse,
  StudentResponse,
} from "@examify-tms/interfaces";

export async function createStudentRequest(
  data: CreateStudentRequest,
): Promise<StudentResponse> {
  const response = await api.post<StudentResponse>("/api/students", data);
  return response.data;
}

export async function listStudentsRequest(): Promise<StudentListResponse> {
  const response = await api.get<StudentListResponse>("/api/students");
  return response.data;
}
