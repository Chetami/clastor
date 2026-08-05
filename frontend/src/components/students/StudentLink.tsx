import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface StudentLinkProps {
  studentId: string;
  name?: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

/**
 * Renders a student's name as a link to their detail page
 * (`/students/:studentId`). Falls back to `fallback` (default: the id)
 * when no name is provided.
 */
export function StudentLink({
  studentId,
  name,
  fallback,
  className,
}: StudentLinkProps) {
  return (
    <Link
      to={`/students/${studentId}`}
      className={cn(
        "font-medium text-primary hover:underline",
        className,
      )}
    >
      {name ?? fallback ?? studentId}
    </Link>
  );
}
