import { useSubjectMap } from "@/lib/subjects";
import { cn } from "@/lib/utils";

interface SubjectChipsProps {
  subjectIds?: string[];
  className?: string;
  size?: "sm" | "default";
}

/**
 * Renders a subject's tags as small chips, resolving ids → names/colors via
 * the auth-store subject catalogue. Unresolvable ids (e.g. for a sys_admin
 * viewing another tutor's student) are hidden.
 */
export function SubjectChips({
  subjectIds,
  className,
  size = "default",
}: SubjectChipsProps) {
  const subjectMap = useSubjectMap();
  const ids = subjectIds ?? [];
  const resolved = ids
    .map((id) => subjectMap.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  if (resolved.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {resolved.map((subject) => (
        <span
          key={subject.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-muted/40 font-medium",
            size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs",
          )}
        >
          {subject.color && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
            />
          )}
          {subject.name}
        </span>
      ))}
    </div>
  );
}
