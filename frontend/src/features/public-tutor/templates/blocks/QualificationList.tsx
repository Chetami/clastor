import { cn } from "@/lib/utils";

/**
 * Bullet list of qualifications. Bullet color / text tone are overridable so
 * templates stay visually distinct while sharing structure.
 */
export function QualificationList({
  qualifications,
  markerClassName,
  textClassName,
}: {
  qualifications: string[];
  markerClassName?: string;
  textClassName?: string;
}) {
  if (qualifications.length === 0) return null;
  return (
    <ul className="space-y-2">
      {qualifications.map((q, i) => (
        <li key={i} className={cn("flex gap-2", textClassName)}>
          <span
            className={cn(
              "mt-2 size-1.5 shrink-0 rounded-full bg-primary",
              markerClassName,
            )}
          />
          <span className="leading-relaxed">{q}</span>
        </li>
      ))}
    </ul>
  );
}
