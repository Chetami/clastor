import type { LessonResponse } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";
import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { Lock } from "lucide-react";
import { lessonBadge } from "@/features/lessons/lesson-display";
import { formatDate } from "../invoice-utils";

/** Numbered step header with a lock state when its prerequisites aren't met. */
export function StepHeader({
  step,
  title,
  locked = false,
}: {
  step: number;
  title: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          locked
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {locked ? <Lock className="h-3 w-3" /> : step}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

/** Placeholder shown when a step is locked (missing prerequisites). */
export function LockedPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Lock className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

interface LessonRowProps {
  lesson: LessonResponse;
  checked: boolean;
  onToggle: () => void;
  badge?: { label: string; tone: string };
}

function LessonRow({ lesson, checked, onToggle, badge }: LessonRowProps) {
  return (
    <TableRow
      onClick={onToggle}
      className="cursor-pointer"
      data-state={checked ? "selected" : undefined}
    >
      <TableCell>
        <Checkbox checked={checked} onClick={(e) => e.stopPropagation()} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{lesson.subject}</span>
          {badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                badge.tone,
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(lesson.startDateTime)}
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {lesson.durationMinutes} min
      </TableCell>
    </TableRow>
  );
}

/** Selectable lessons table with a status badge per row. */
export function LessonsTable({
  lessons,
  selectedLessonIds,
  onToggle,
}: {
  lessons: LessonResponse[];
  selectedLessonIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-10" />
            <TableHead>Lesson</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              checked={selectedLessonIds.has(lesson.id)}
              onToggle={() => onToggle(lesson.id)}
              badge={lessonBadge(lesson)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Compact read-only upcoming-lessons table (no badge, used in prepay section). */
export function UpcomingLessonsTable({
  lessons,
  selectedLessonIds,
  onToggle,
}: {
  lessons: LessonResponse[];
  selectedLessonIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-10" />
          <TableHead>Lesson</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            checked={selectedLessonIds.has(lesson.id)}
            onToggle={() => onToggle(lesson.id)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
