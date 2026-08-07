import { TriangleAlert } from "lucide-react";
import type { ExternalCalendarEvent } from "@examify-tms/interfaces";

interface EventWarningsProps {
  overlaps: ExternalCalendarEvent[];
  outsideHours: boolean;
}

/** Non-blocking warnings: Google Calendar overlap + outside working hours. */
export function EventWarnings({ overlaps, outsideHours }: EventWarningsProps) {
  if (overlaps.length === 0 && !outsideHours) return null;
  return (
    <>
      {overlaps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">
              Overlaps with a Google Calendar event
            </p>
            <ul className="list-inside list-disc text-amber-600/90 dark:text-amber-400/90">
              {overlaps.map((ev) => (
                <li key={ev.id}>{ev.title}</li>
              ))}
            </ul>
            <p className="text-amber-600/80 dark:text-amber-400/80">
              You can still create this lesson.
            </p>
          </div>
        </div>
      )}
      {outsideHours && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Outside your working hours</p>
            <p className="text-amber-600/80 dark:text-amber-400/80">
              This time is outside the working hours you set. You can still
              create this lesson, or adjust your hours in Settings.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
