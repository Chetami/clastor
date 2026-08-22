import type { Subject } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";

/**
 * Wrapping list of subject chips resolved from the tutor's catalogue, so
 * each chip can carry the subject's color as a leading dot. `chipClassName`
 * lets each template supply its own chip styling (bordered, filled, etc.).
 */
export function SubjectChips({
  subjects,
  chipClassName,
  max,
}: {
  subjects: Subject[];
  chipClassName?: string;
  max?: number;
}) {
  if (subjects.length === 0) return null;
  const shown = max ? subjects.slice(0, max) : subjects;
  const overflow = subjects.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((subject) => (
        <li
          key={subject.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
            chipClassName,
          )}
        >
          {subject.color && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
              aria-hidden
            />
          )}
          {subject.name}
        </li>
      ))}
      {overflow > 0 && (
        <li
          className={cn(
            "rounded-full px-3 py-1 text-sm",
            chipClassName,
          )}
        >
          +{overflow} more
        </li>
      )}
    </ul>
  );
}
