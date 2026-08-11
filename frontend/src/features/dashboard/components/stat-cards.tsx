import {
  Clock,
  DollarSign,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  BookCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useUserCurrency } from "@/lib/use-currency";
import type {
  DashboardPeriod,
  DashboardSummaryResponse,
} from "@examify-tms/interfaces";
import {
  formatCurrencyWhole,
  formatHours,
  deltaPercent,
  previousPeriodLabel,
  currentPeriodLabel,
} from "../lib";

type TileProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  children?: React.ReactNode;
};

function Tile({ icon, label, value, delta, children }: TileProps) {
  const isUp = (delta ?? null) !== null && delta! > 0;
  const isDown = (delta ?? null) !== null && delta! < 0;

  return (
    <Card className="p-4 gap-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-xl font-semibold leading-none tracking-tight">
          {value}
        </p>
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              isUp && "text-emerald-600 dark:text-emerald-500",
              isDown && "text-red-600 dark:text-red-500",
              !isUp && !isDown && "text-muted-foreground",
            )}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : isDown ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(Math.round(delta!))}%
          </span>
        )}
      </div>
      {children && (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {children}
        </div>
      )}
    </Card>
  );
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function StatCards({
  summary,
  period,
  expectedIncome,
  plannedLessonCount,
}: {
  summary: DashboardSummaryResponse;
  period: DashboardPeriod;
  expectedIncome: number;
  plannedLessonCount: number;
}) {
  const currency = useUserCurrency();
  const hoursDelta = deltaPercent(
    summary.hoursWorked,
    summary.previousHoursWorked,
  );
  const incomeDelta = deltaPercent(summary.income, summary.previousIncome);
  const lessonsDelta = deltaPercent(
    summary.lessonsTaught,
    summary.previousLessonsTaught,
  );
  const prevLabel = previousPeriodLabel(period);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Income */}
      <Tile
        icon={<DollarSign className="h-4 w-4" />}
        label="Income"
        value={formatCurrencyWhole(summary.income, currency)}
        delta={incomeDelta}
      >
        <p>
          {prevLabel} {formatCurrencyWhole(summary.previousIncome, currency)}
        </p>
        <p>
          Outstanding {formatCurrencyWhole(summary.outstandingAmount, currency)}
          {summary.overdueAmount > 0 && (
            <span className="font-medium text-red-600 dark:text-red-500">
              {" "}
              · incl. {formatCurrencyWhole(
                summary.overdueAmount,
                currency,
              )}{" "}
              overdue
            </span>
          )}
        </p>
      </Tile>

      {/* Hours */}
      <Tile
        icon={<Clock className="h-4 w-4" />}
        label="Hours taught"
        value={formatHours(summary.hoursWorked)}
        delta={hoursDelta}
      >
        <p>
          {prevLabel} {formatHours(summary.previousHoursWorked)}
        </p>
      </Tile>

      {/* Lessons */}
      <Tile
        icon={<BookCheck className="h-4 w-4" />}
        label="Lessons taught"
        value={String(summary.lessonsTaught)}
        delta={lessonsDelta}
      >
        <p>
          {prevLabel} {summary.previousLessonsTaught}
        </p>
        <p>{formatRate(summary.attendanceRate)} attendance</p>
      </Tile>

      {/* Expected income */}
      <Tile
        icon={<Wallet className="h-4 w-4" />}
        label="Expected income"
        value={formatCurrencyWhole(expectedIncome, currency)}
      >
        {plannedLessonCount > 0 ? (
          <p>
            {plannedLessonCount} planned{" "}
            {plannedLessonCount === 1 ? "lesson" : "lessons"}{" "}
            {currentPeriodLabel(period).toLowerCase()}
          </p>
        ) : (
          <p>Nothing planned {currentPeriodLabel(period).toLowerCase()}</p>
        )}
      </Tile>
    </div>
  );
}
