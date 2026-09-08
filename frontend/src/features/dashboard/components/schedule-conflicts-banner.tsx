import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarClock,
  ChevronDown,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";
import type {
  ExternalCalendarEvent,
  LessonResponse,
} from "@examify-tms/interfaces";
import {
  lessonTimeRange,
  relativeDayLabel,
  type ConflictPeer,
  type ScheduleConflict,
} from "../lib";

type Props = {
  conflicts: ScheduleConflict[];
  studentNames: Record<string, string>;
};

/** "Bob · Physics — Today, 15:00 – 16:00" */
function lessonLabel(
  lesson: LessonResponse,
  studentNames: Record<string, string>,
): string {
  const student = studentNames[lesson.studentId] ?? "Student";
  const who = lesson.subject ? `${student} · ${lesson.subject}` : student;
  return `${who} — ${relativeDayLabel(lesson.startDateTime)}, ${lessonTimeRange(lesson)}`;
}

/** "HH:mm – HH:mm" range for an external Google Calendar event. */
function eventTimeRange(event: ExternalCalendarEvent): string {
  return `${format(new Date(event.startDateTime), "HH:mm")} – ${format(
    new Date(event.endDateTime),
    "HH:mm",
  )}`;
}

/** "“Dentist” — Today, 15:30 – 16:30" */
function eventLabel(event: ExternalCalendarEvent): string {
  return `“${event.title}” — ${relativeDayLabel(event.startDateTime)}, ${eventTimeRange(event)}`;
}

function peerLabel(
  peer: ConflictPeer,
  studentNames: Record<string, string>,
): string {
  return peer.kind === "lesson"
    ? lessonLabel(peer.lesson, studentNames)
    : eventLabel(peer.event);
}

/**
 * Attention-grabbing banner listing upcoming schedule conflicts — lessons
 * overlapping other lessons or external Google Calendar events. Each row
 * offers a reschedule action (reusing the schedule's RescheduleDialog), so
 * the banner self-resolves as conflicts are fixed.
 */
export function ScheduleConflictsBanner({ conflicts, studentNames }: Props) {
  const [rescheduleTarget, setRescheduleTarget] =
    useState<LessonResponse | null>(null);

  if (conflicts.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-500/10">
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {conflicts.length === 1
                  ? "Schedule conflict"
                  : `${conflicts.length} schedule conflicts`}
              </p>
              <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
                Overlapping events in the next two weeks — move one of each
                pair so nothing gets double-booked.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5"
          >
            <Link to="/schedule">
              <CalendarClock className="h-4 w-4" />
              View schedule
            </Link>
          </Button>
        </div>

        <ScrollArea className="max-h-72">
          <ul className="space-y-2 pr-3">
            {conflicts.map((conflict) => {
              // Narrow once here — the discriminated union doesn't survive
              // into the item onSelect closures below.
              const peerLesson =
                conflict.peer.kind === "lesson" ? conflict.peer.lesson : null;
              return (
              <li
                key={conflict.id}
                className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-background/70 p-3 dark:bg-background/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {lessonLabel(conflict.lesson, studentNames)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Conflicts with {peerLabel(conflict.peer, studentNames)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {peerLesson ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          Reschedule
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setRescheduleTarget(conflict.lesson)}
                        >
                          Move {lessonLabel(conflict.lesson, studentNames)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setRescheduleTarget(peerLesson)}
                        >
                          Move {lessonLabel(peerLesson, studentNames)}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRescheduleTarget(conflict.lesson)}
                    >
                      Reschedule
                    </Button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>

      {rescheduleTarget && (
        <RescheduleDialog
          lesson={rescheduleTarget}
          open
          onOpenChange={(open) => {
            if (!open) setRescheduleTarget(null);
          }}
        />
      )}
    </Card>
  );
}