import { useMutation } from "@tanstack/react-query";
import { recordAttendanceRequest } from "./requests";
import type { AttendanceStatus, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

/**
 * Mark a lesson's attendance. Unlike schedule's useRecordAttendance (bound to
 * a single id), this accepts a variable id so the dashboard todo list can mark
 * any lesson done in place. Invalidates lesson + dashboard caches on success.
 */
export function useMarkLessonDone() {
  return useMutation<
    LessonResponse,
    Error,
    { id: string; attendanceStatus: AttendanceStatus }
  >({
    mutationFn: ({ id, attendanceStatus }) =>
      recordAttendanceRequest(id, attendanceStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
