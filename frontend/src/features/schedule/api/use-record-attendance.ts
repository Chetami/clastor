import { useMutation } from "@tanstack/react-query";
import { recordAttendanceRequest } from "./requests";
import type { AttendanceStatus, LessonResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useRecordAttendance(id: string) {
  return useMutation<LessonResponse, Error, AttendanceStatus>({
    mutationFn: (attendanceStatus: AttendanceStatus) =>
      recordAttendanceRequest(id, attendanceStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons", id] });
    },
  });
}
