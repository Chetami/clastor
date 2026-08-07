import { useMemo } from "react";
import type { StudentResponse } from "@examify-tms/interfaces";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";

export interface StudentLookups {
  /** studentId → display name */
  names: Record<string, string>;
  /** studentId → full student record */
  byId: Record<string, StudentResponse>;
  /** studentId → list of that student's subject names (from the catalogue) */
  subjectOptions: Record<string, string[]>;
}

/**
 * Build the three student lookup maps (name / record / subject options) that
 * several surfaces need (lesson rows, attendance dialogs, dashboard, schedule).
 * React Query dedupes the underlying students + subjects requests across every
 * caller, so this is cheap to call from multiple components.
 */
export function useStudentLookups(): StudentLookups {
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();

  return useMemo<StudentLookups>(() => {
    const names: Record<string, string> = {};
    const byId: Record<string, StudentResponse> = {};
    const subjectOptions: Record<string, string[]> = {};
    for (const s of students) {
      names[s.id] = s.name;
      byId[s.id] = s;
      subjectOptions[s.id] = (s.subjectIds ?? [])
        .map((id) => subjects.find((sub) => sub.id === id)?.name)
        .filter((n): n is string => !!n);
    }
    return { names, byId, subjectOptions };
  }, [students, subjects]);
}
