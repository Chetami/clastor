import { api } from "../../../lib/api";
import type {
  CreateLessonRequest,
  UpdateLessonRequest,
  UpdateLessonSeriesRequest,
  RescheduleLessonRequest,
  RecordAttendanceRequest,
  CancelLessonRequest,
  NotifyStudentRequest,
  AttendanceStatus,
  CreateRecurringLessonRequest,
  CreateRecurringLessonResponse,
  GenerateMeetLinkRequest,
  GenerateMeetLinkResponse,
  GoogleConnectionStatus,
  LessonResponse,
  LessonListResponse,
  LessonSeriesResponse,
  GenerateSeriesMeetLinkResponse,
  ExternalCalendarEventListResponse,
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

/**
 * Query parameters accepted by GET /api/lessons. All optional.
 *
 * Two modes:
 *  - Paginated (lessons list): `status` + `limit` + `cursor` (for pages
 *    after the first). Returns one cursor-paginated page.
 *  - Unpaginated (calendar window / dashboard / invoices): omit `limit` to
 *    receive the full matching set.
 */
export interface ListLessonsParams {
  from?: string;
  to?: string;
  studentId?: string;
  seriesId?: string;
  unpaid?: boolean;
  acceptanceStatus?: string;
  attendanceStatus?: string;
  status?: "upcoming" | "past" | "cancelled" | "all";
  limit?: number;
  cursor?: string;
}

export async function listLessonsRequest(
  params?: ListLessonsParams,
): Promise<LessonListResponse> {
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

export async function rescheduleLessonRequest(
  id: string,
  data: RescheduleLessonRequest,
): Promise<LessonResponse> {
  const response = await api.patch<LessonResponse>(
    `/api/lessons/${id}/reschedule`,
    data,
  );
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
  data?: CancelLessonRequest,
): Promise<LessonResponse> {
  const response = await api.patch<LessonResponse>(
    `/api/lessons/${id}/cancel`,
    data ?? {},
  );
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

/**
 * Fetch a single lesson series by ID (metadata only — occurrences are
 * fetched via listLessonsRequest with `seriesId`).
 */
export async function getLessonSeriesRequest(
  seriesId: string,
): Promise<LessonSeriesResponse> {
  const response = await api.get<LessonSeriesResponse>(
    `/api/lessons/series/${seriesId}`,
  );
  return response.data;
}

/**
 * Update a lesson series template (subject, duration, location, notes,
 * reminders, acceptance). Template changes propagate to future non-exception
 * occurrences server-side.
 */
export async function updateLessonSeriesRequest(
  seriesId: string,
  data: UpdateLessonSeriesRequest,
): Promise<LessonSeriesResponse> {
  const response = await api.patch<LessonSeriesResponse>(
    `/api/lessons/series/${seriesId}`,
    data,
  );
  return response.data;
}

/**
 * Generate ONE shared Google Meet link for an entire series and apply it to
 * every upcoming lesson. Returns the shared link and how many lessons it was
 * applied to.
 */
export async function generateSeriesMeetLinkRequest(
  seriesId: string,
): Promise<GenerateSeriesMeetLinkResponse> {
  const response = await api.post<GenerateSeriesMeetLinkResponse>(
    `/api/lessons/series/${seriesId}/generate-meet`,
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

export async function getExternalCalendarEventsRequest(params: {
  from: string;
  to: string;
}): Promise<ExternalCalendarEventListResponse> {
  const response = await api.get<ExternalCalendarEventListResponse>(
    "/api/calendar/events",
    { params },
  );
  return response.data;
}

export async function syncCalendarRequest(): Promise<{
  pushed: number;
  recovered: number;
  skipped: number;
}> {
  const response = await api.post<{
    pushed: number;
    recovered: number;
    skipped: number;
  }>("/api/calendar/sync");
  return response.data;
}

export type ResyncLessonAction = "created" | "updated" | "recreated";

export async function resyncLessonRequest(
  id: string,
): Promise<{ lesson: LessonResponse; action: ResyncLessonAction }> {
  const response = await api.post<{
    lesson: LessonResponse;
    action: ResyncLessonAction;
  }>(`/api/lessons/${id}/resync`);
  return response.data;
}
