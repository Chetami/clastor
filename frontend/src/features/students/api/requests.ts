import { api } from "@/lib/api";
import type {
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentListResponse,
  StudentResponse,
  StudentImportSummary,
} from "@examify-tms/interfaces";

export async function createStudentRequest(
  data: CreateStudentRequest,
): Promise<StudentResponse> {
  const response = await api.post<StudentResponse>("/api/students", data);
  return response.data;
}

export async function updateStudentRequest(
  id: string,
  data: UpdateStudentRequest,
): Promise<StudentResponse> {
  const response = await api.put<StudentResponse>(`/api/students/${id}`, data);
  return response.data;
}

export async function listStudentsRequest(): Promise<StudentListResponse> {
  const response = await api.get<StudentListResponse>("/api/students");
  return response.data;
}

export async function getStudentRequest(id: string): Promise<StudentResponse> {
  const response = await api.get<StudentResponse>(`/api/students/id/${id}`);
  return response.data;
}

export async function importStudentsRequest(
  file: File,
): Promise<StudentImportSummary> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<StudentImportSummary>(
    "/api/students/import",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}
