import { cn } from "@/lib/utils";

/**
 * Wrapping list of subject chips. `chipClassName` lets each template supply its
 * own chip styling (bordered, filled, colored, etc.).
 */
export function SubjectChips({
  subjects,
  chipClassName,
}: {
  subjects: string[];
  chipClassName?: string;
}) {
  if (subjects.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {subjects.map((subject, i) => (
        <li
          key={i}
          className={cn("rounded-full px-3 py-1 text-sm", chipClassName)}
        >
          {subject}
        </li>
      ))}
    </ul>
  );
}
