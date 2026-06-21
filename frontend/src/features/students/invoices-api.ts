import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Invoice } from "@examify-tms/interfaces";
import type { UseQueryResult } from "@tanstack/react-query";

interface StudentDebtResponse {
  total: number;
}

async function fetchStudentDebt(studentId: string): Promise<StudentDebtResponse> {
  const response = await api.get<StudentDebtResponse>(
    `/api/payments/student/${studentId}/debt`,
  );
  return response.data;
}

export function useStudentInvoices(studentId: string | undefined): UseQueryResult<Invoice[]> {
  return useQuery({
    queryKey: ["student-invoices", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await api.get<{ data: Invoice[]; total: number }>(
        `/api/payments/student/${studentId}/invoices`,
      );
      return response.data.data;
    },
    enabled: !!studentId,
  });
}

export function useStudentDebt(studentId: string | undefined): UseQueryResult<number> {
  return useQuery({
    queryKey: ["student-debt", studentId],
    queryFn: async () => {
      if (!studentId) return 0;
      const result = await fetchStudentDebt(studentId);
      return result.total;
    },
    enabled: !!studentId,
  });
}

export function useStudentsDebts(
  studentIds: string[]
): Array<UseQueryResult<number>> {
  return useQueries({
    queries: studentIds.map((studentId) => ({
      queryKey: ["student-debt", studentId],
      queryFn: async () => {
        const result = await fetchStudentDebt(studentId);
        return result.total;
      },
      enabled: !!studentId,
      staleTime: 1000 * 60 * 5,
    })),
  });
}

