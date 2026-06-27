import { api } from "@/lib/api";
import type { AdminTutorListResponse } from "@examify-tms/interfaces";

export async function listAdminTutorsRequest(): Promise<AdminTutorListResponse> {
  const response = await api.get<AdminTutorListResponse>("/api/admin/tutors");
  return response.data;
}
