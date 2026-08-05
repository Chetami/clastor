import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Clock,
  Globe,
  Hash,
  Repeat,
  User,
  Video,
  ExternalLink,
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
import { Button } from "@/components/ui/button";
import { ACCEPTANCE_LABELS } from "@/features/schedule/lesson-utils";
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
  /** Shared Meet link for the series, if one has been generated. */
  meetLink?: string | null;
  /** Generate (or regenerate) a shared Meet link for all upcoming lessons. */
  onGenerateMeet?: () => void;
  meetDisabled?: boolean;
  meetPending?: boolean;
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children}</dd>
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
  meetLink,
  onGenerateMeet,
  meetDisabled,
  meetPending,
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
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 p-6">
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
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {studentName && (
              <MetaItem icon={<User className="h-3 w-3" />} label="Student">
                <StudentLink studentId={studentId} name={studentName} />
              </MetaItem>
            )}
            {slotLabel && (
              <MetaItem
                icon={<CalendarClock className="h-3 w-3" />}
                label="Schedule"
              >
                {slotLabel}
              </MetaItem>
            )}
            <MetaItem icon={<Clock className="h-3 w-3" />} label="Duration">
              {durationMinutes} min
            </MetaItem>
            <MetaItem
              icon={<CalendarDays className="h-3 w-3" />}
              label="Date range"
            >
              {formatRange(startDate, until)}
            </MetaItem>
            {count ? (
              <MetaItem icon={<Hash className="h-3 w-3" />} label="Sessions">
                {count}
              </MetaItem>
            ) : null}
            <MetaItem icon={<Globe className="h-3 w-3" />} label="Timezone">
              {timezone}
            </MetaItem>
          </dl>
        </div>
        {(onAcceptanceChange || onGenerateMeet) && (
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[180px]">
            {onAcceptanceChange && (
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
            )}
            {onGenerateMeet && (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2">
                <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Google Meet
                </span>
                {meetLink ? (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <a href={meetLink} target="_blank" rel="noreferrer">
                        <Video className="h-4 w-4" />
                        Join Meet
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={meetDisabled || meetPending}
                      onClick={onGenerateMeet}
                    >
                      {meetPending ? "Regenerating…" : "Regenerate"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={meetDisabled || meetPending}
                    onClick={onGenerateMeet}
                  >
                    <Video className="h-4 w-4" />
                    {meetPending ? "Generating…" : "Generate Meet"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
