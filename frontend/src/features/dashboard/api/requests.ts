import { api } from "@/lib/api";
import type {
  DashboardPeriod,
  DashboardSummaryResponse,
  GenerateMeetLinkRequest,
  GenerateMeetLinkResponse,
  AttendanceStatus,
  LessonResponse,
} from "@examify-tms/interfaces";

export async function getDashboardSummaryRequest(
  period: DashboardPeriod,
): Promise<DashboardSummaryResponse> {
  const response = await api.get<DashboardSummaryResponse>(
    "/api/dashboard/summary",
    { params: { period } },
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

export async function recordAttendanceRequest(
  id: string,
  attendanceStatus: AttendanceStatus,
): Promise<LessonResponse> {
  const response = await api.patch<LessonResponse>(
    `/api/lessons/${id}/attendance`,
    { attendanceStatus },
  );
  return response.data;
}
