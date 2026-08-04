import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Clock,
  Globe,
  Hash,
  Repeat,
  User,
} from "lucide-react";
import type * as React from "react";
import type { LessonSlot } from "@examify-tms/interfaces";
import { ACCEPTANCE_LABELS } from "@/features/schedule/lesson-utils";
import { getInitials } from "@/features/lessons/lesson-display";
import { ACCEPTANCE_TONE, formatRange, formatSlot } from "./lesson-series-utils";

export interface SeriesHeaderProps {
  subject: string;
  studentName?: string;
  studentId: string;
  acceptance: keyof typeof ACCEPTANCE_LABELS;
  intervalWeeks: number;
  slots: LessonSlot[];
  durationMinutes: number;
  timezone: string;
  startDate: string;
  until: string | null;
  count: number | null | undefined;
  issueCount: number;
}

function MetaItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}

export function SeriesHeader({
  subject,
  studentName,
  studentId,
  acceptance,
  intervalWeeks,
  slots,
  durationMinutes,
  timezone,
  startDate,
  until,
  count,
  issueCount,
}: SeriesHeaderProps) {
  const cadence =
    intervalWeeks === 1
      ? "Weekly"
      : intervalWeeks === 2
        ? "Biweekly"
        : `Every ${intervalWeeks} weeks`;
  const slotLabel = slots.map(formatSlot).join(" · ");
  return (
    <div className="shrink-0 space-y-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
          {getInitials(studentName ?? studentId)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {subject || "Lesson series"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3 w-3" />
              Recurring
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCEPTANCE_TONE[acceptance] ?? "bg-muted text-muted-foreground"}`}
            >
              {ACCEPTANCE_LABELS[acceptance]}
            </span>
            {issueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                <CircleAlert className="h-3 w-3" />
                {issueCount} {issueCount === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {studentName && (
              <MetaItem icon={<User className="h-3.5 w-3.5" />}>
                {studentName}
              </MetaItem>
            )}
            <MetaItem icon={<Repeat className="h-3.5 w-3.5" />}>
              {cadence}
            </MetaItem>
            {slotLabel && (
              <MetaItem icon={<CalendarClock className="h-3.5 w-3.5" />}>
                {slotLabel}
              </MetaItem>
            )}
            <MetaItem icon={<Clock className="h-3.5 w-3.5" />}>
              {durationMinutes} min
            </MetaItem>
            <MetaItem icon={<CalendarDays className="h-3.5 w-3.5" />}>
              {formatRange(startDate, until)}
            </MetaItem>
            {count ? (
              <MetaItem icon={<Hash className="h-3.5 w-3.5" />}>
                {count} sessions
              </MetaItem>
            ) : null}
            <MetaItem icon={<Globe className="h-3.5 w-3.5" />}>
              {timezone}
            </MetaItem>
          </div>
        </div>
      </div>
    </div>
  );
}
