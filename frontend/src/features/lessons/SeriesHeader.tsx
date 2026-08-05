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
import type { LessonAcceptance, LessonSlot } from "@examify-tms/interfaces";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCEPTANCE_LABELS } from "@/features/schedule/lesson-utils";
import { getInitials } from "@/features/lessons/lesson-display";
import { StudentLink } from "@/components/students/StudentLink";
import { ACCEPTANCE_TONE, formatRange, formatSlot } from "./lesson-series-utils";

export interface SeriesHeaderProps {
  subject: string;
  studentName?: string;
  studentId: string;
  acceptance: LessonAcceptance;
  onAcceptanceChange?: (value: LessonAcceptance) => void;
  acceptanceDisabled?: boolean;
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
  onAcceptanceChange,
  acceptanceDisabled,
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
    <div className="shrink-0 space-y-3.5 rounded-xl border bg-card text-card-foreground shadow">
      <div className="flex flex-wrap items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
          {getInitials(studentName ?? studentId)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {subject || "Lesson series"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3 w-3" />
              {cadence}
            </span>
            {onAcceptanceChange ? null : (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCEPTANCE_TONE[acceptance] ?? "bg-muted text-muted-foreground"}`}
              >
                {ACCEPTANCE_LABELS[acceptance]}
              </span>
            )}
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
                <StudentLink studentId={studentId} name={studentName} />
              </MetaItem>
            )}
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
        {onAcceptanceChange && (
          <div className="w-full shrink-0 sm:w-56">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Student acceptance
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACCEPTANCE_TONE[acceptance] ?? "bg-muted text-muted-foreground"}`}
              >
                {ACCEPTANCE_LABELS[acceptance]}
              </span>
            </div>
            <Select
              value={acceptance}
              disabled={acceptanceDisabled}
              onValueChange={(v) => onAcceptanceChange(v as LessonAcceptance)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["pending", "accepted", "declined"] as LessonAcceptance[]).map(
                  (opt) => (
                    <SelectItem key={opt} value={opt}>
                      {ACCEPTANCE_LABELS[opt]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Applies to all upcoming lessons.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
