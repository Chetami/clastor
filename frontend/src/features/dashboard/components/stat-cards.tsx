import { Clock, DollarSign, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardSummaryResponse } from "@examify-tms/interfaces";
import { formatCurrency, formatHours, deltaPercent } from "../lib";

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number | null;
  invertDelta?: boolean;
};

function StatCard({ icon, label, value, delta, invertDelta }: StatCardProps) {
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  const good = invertDelta ? isDown : isUp;
  const bad = invertDelta ? isUp : isDown;

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
      {delta !== null && (
        <div className="px-5 pb-4 -mt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              good && "text-emerald-600 dark:text-emerald-500",
              bad && "text-red-600 dark:text-red-500",
              !good && !bad && "text-muted-foreground",
            )}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : isDown ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(Math.round(delta))}% vs last period
          </span>
        </div>
      )}
    </Card>
  );
}

export function StatCards({ summary }: { summary: DashboardSummaryResponse }) {
  const hoursDelta = deltaPercent(summary.hoursWorked, summary.previousHoursWorked);
  const incomeDelta = deltaPercent(summary.income, summary.previousIncome);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label="Hours taught"
        value={formatHours(summary.hoursWorked)}
        delta={hoursDelta}
      />
      <StatCard
        icon={<DollarSign className="h-5 w-5" />}
        label="Income collected"
        value={formatCurrency(summary.income)}
        delta={incomeDelta}
      />
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Active students"
        value={String(summary.studentCount)}
        delta={null}
      />
    </div>
  );
}
