import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Invoice } from "@examify-tms/interfaces";

export function useStudentInvoices(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-invoices", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await api.get<{ data: Invoice[]; total: number }>(
        `/api/payments/student/${studentId}/invoices`
      );
      return response.data.data;
    },
    enabled: !!studentId,
  });
}

export function useStudentDebt(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-debt", studentId],
    queryFn: async () => {
      if (!studentId) return 0;
      const response = await api.get<{ total: number }>(
        `/api/payments/student/${studentId}/debt`
      );
      return response.data.total;
    },
    enabled: !!studentId,
  });
}