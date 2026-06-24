import type { Subject } from "@examify-tms/interfaces";
import { useAuthStore } from "@/store/auth-store";

/**
 * The tutor's subject catalogue, sourced from the auth store (populated at
 * login/verify). Single source of truth for resolving student `subjectIds`.
 */
export function useSubjects(): Subject[] {
  const subjects = useAuthStore((s) => s.user?.subjects);
  return subjects ?? [];
}

/** Map of subject id → Subject, for quick lookup when rendering tags. */
export function useSubjectMap(): Map<string, Subject> {
  const subjects = useSubjects();
  return new Map(subjects.map((s) => [s.id, s]));
}

/** Comma-joined display names for a set of subject ids. "" if none resolve. */
export function resolveSubjectNames(
  subjectIds: string[] | undefined,
  subjects: Subject[],
): string {
  if (!subjectIds || subjectIds.length === 0) return "";
  return subjectIds
    .map((id) => subjects.find((s) => s.id === id)?.name)
    .filter((n): n is string => !!n)
    .join(", ");
}

/** Generate a client-side subject id (stable across renames). */
export function generateSubjectId(): string {
  return `subj_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}
