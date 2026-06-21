import { api } from "@/lib/api";
import type {
  CreateLessonRequest,
  UpdateLessonRequest,
  RecordAttendanceRequest,
  NotifyStudentRequest,
  AttendanceStatus,
  CreateRecurringLessonRequest,
  CreateRecurringLessonResponse,
  GenerateMeetLinkRequest,
  GenerateMeetLinkResponse,
  GoogleConnectionStatus,
  LessonResponse,
  LessonListResponse,
} from "@examify-tms/interfaces";

export async function createLessonRequest(
  data: CreateLessonRequest,
): Promise<LessonResponse> {
  const response = await api.post<LessonResponse>("/api/lessons", data);
  return response.data;
}

export async function createRecurringLessonRequest(
  data: CreateRecurringLessonRequest,
): Promise<CreateRecurringLessonResponse> {
  const response = await api.post<CreateRecurringLessonResponse>(
    "/api/lessons/recurring",
    data,
  );
  return response.data;
}

export async function listLessonsRequest(params?: {
  from?: string;
  to?: string;
  studentId?: string;
  unpaid?: boolean;
}): Promise<LessonListResponse> {
  const response = await api.get<LessonListResponse>("/api/lessons", {
    params,
  });
  return response.data;
}

export async function getLessonRequest(id: string): Promise<LessonResponse> {
  const response = await api.get<LessonResponse>(`/api/lessons/${id}`);
  return response.data;
}

export async function updateLessonRequest(
  id: string,
  data: UpdateLessonRequest,
): Promise<LessonResponse> {
  const response = await api.patch<LessonResponse>(`/api/lessons/${id}`, data);
  return response.data;
}

export async function recordAttendanceRequest(
  id: string,
  attendanceStatus: AttendanceStatus,
): Promise<LessonResponse> {
  const body: RecordAttendanceRequest = { attendanceStatus };
  const response = await api.patch<LessonResponse>(
    `/api/lessons/${id}/attendance`,
    body,
  );
  return response.data;
}

export async function cancelLessonRequest(
  id: string,
): Promise<LessonResponse> {
  const response = await api.patch<LessonResponse>(`/api/lessons/${id}/cancel`);
  return response.data;
}

export async function notifyStudentRequest(
  id: string,
  message?: string,
): Promise<LessonResponse> {
  const body: NotifyStudentRequest = { message: message ?? null };
  const response = await api.post<LessonResponse>(
    `/api/lessons/${id}/notify-student`,
    body,
  );
  return response.data;
}

export async function cancelLessonSeriesRequest(
  seriesId: string,
): Promise<{ cancelled: number }> {
  const response = await api.delete<{ cancelled: number }>(
    `/api/lessons/series/${seriesId}`,
  );
  return response.data;
}

export async function generateMeetLinkRequest(
  data?: GenerateMeetLinkRequest,
): Promise<GenerateMeetLinkResponse> {
  const response = await api.post<GenerateMeetLinkResponse>(
    "/api/meetings",
    data,
  );
  return response.data;
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const response = await api.get<GoogleConnectionStatus>(
    "/api/auth/google/status",
  );
  return response.data;
}

export async function getGoogleAuthUrl(): Promise<{ authUrl: string }> {
  const response = await api.get<{ authUrl: string }>("/api/auth/google/url");
  return response.data;
}
