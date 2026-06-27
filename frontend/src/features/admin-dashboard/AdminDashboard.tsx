import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookCheck,
  Clock,
  DollarSign,
  GraduationCap,
  MessageSquareText,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  Wallet,
} from "lucide-react";
import type { DashboardPeriod } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useUserCurrency } from "@/lib/use-currency";
import { PeriodSelector } from "@/features/dashboard/components/period-selector";
import { IncomeChart } from "@/features/dashboard/components/income-chart";
import { HoursChart } from "@/features/dashboard/components/hours-chart";
import { ChartSkeleton } from "@/features/dashboard/components/skeletons";
import { useDashboardSummary } from "@/features/dashboard/api";
import {
  formatCurrency,
  formatHours,
  deltaPercent,
  previousPeriodLabel,
} from "@/features/dashboard/lib";
import { useAdminOverview } from "./api";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatTile({
  icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  sub?: React.ReactNode;
}) {
  const isUp = (delta ?? null) !== null && delta! > 0;
  const isDown = (delta ?? null) !== null && delta! < 0;
  return (
    <Card className="p-4">
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
      {sub && (
        <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </Card>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const FEEDBACK_BADGE: Record<string, { label: string; variant: "danger" | "secondary" | "warning" }> = {
  bug: { label: "Bug", variant: "danger" },
  feedback: { label: "Feedback", variant: "secondary" },
  feature_request: { label: "Idea", variant: "warning" },
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const currency = useUserCurrency();

  const { data: summary, isLoading: summaryLoading } =
    useDashboardSummary(period);
  const { data: overview, isLoading: overviewLoading } =
    useAdminOverview(period);

  const incomeDelta = summary ? deltaPercent(summary.income, summary.previousIncome) : null;
  const hoursDelta = summary
    ? deltaPercent(summary.hoursWorked, summary.previousHoursWorked)
    : null;
  const lessonsDelta = summary
    ? deltaPercent(summary.lessonsTaught, summary.previousLessonsTaught)
    : null;
  const activeTutorsDelta = overview
    ? deltaPercent(overview.activeTutors, overview.previousActiveTutors)
    : null;
  const prevLabel = previousPeriodLabel(period);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Platform overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Activity across all tutors on Clastor.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Income collected"
          value={summary ? formatCurrency(summary.income, currency) : "—"}
          delta={incomeDelta}
          sub={
            summary && (
              <>
                {prevLabel} {formatCurrency(summary.previousIncome, currency)}
              </>
            )
          }
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Hours taught"
          value={summary ? formatHours(summary.hoursWorked) : "—"}
          delta={hoursDelta}
          sub={summary && <>{prevLabel} {formatHours(summary.previousHoursWorked)}</>}
        />
        <StatTile
          icon={<BookCheck className="h-4 w-4" />}
          label="Lessons taught"
          value={summary ? String(summary.lessonsTaught) : "—"}
          delta={lessonsDelta}
          sub={summary && <>{prevLabel} {summary.previousLessonsTaught}</>}
        />
        <StatTile
          icon={<GraduationCap className="h-4 w-4" />}
          label="Active tutors"
          value={overview ? String(overview.activeTutors) : "—"}
          delta={activeTutorsDelta}
          sub={
            overview && (
              <>
                {overview.totalTutors} total · {overview.newTutorsThisPeriod} new{" "}
                {period === "week" ? "this week" : "this period"}
              </>
            )
          }
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Active students"
          value={overview ? String(overview.activeStudents) : "—"}
        />
        <StatTile
          icon={<Wallet className="h-4 w-4" />}
          label="Outstanding"
          value={summary ? formatCurrency(summary.outstandingAmount, currency) : "—"}
          sub={
            summary &&
            summary.overdueAmount > 0 && (
              <span className="font-medium text-red-600 dark:text-red-500">
                {formatCurrency(summary.overdueAmount, currency)} overdue
              </span>
            )
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {summaryLoading || !summary ? (
          <ChartSkeleton />
        ) : (
          <IncomeChart summary={summary} />
        )}
        {summaryLoading || !summary ? (
          <ChartSkeleton />
        ) : (
          <HoursChart summary={summary} />
        )}
      </div>

      {/* Top tutors + side column */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Top tutors</CardTitle>
            <span className="text-xs text-muted-foreground">by income · {prevLabel.toLowerCase()}</span>
          </CardHeader>
          <CardContent>
            {overviewLoading || !overview ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : overview.topTutors.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tutoring activity this period yet.
              </p>
            ) : (
              <ol className="space-y-1">
                {overview.topTutors.map((t, i) => (
                  <li
                    key={t.tutorId}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <span className="w-4 text-sm font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <Avatar className="size-8">
                      {t.avatarUrl && (
                        <AvatarImage src={t.avatarUrl} alt={t.name} />
                      )}
                      <AvatarFallback>{initials(t.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.lessonsTaught} lessons · {formatHours(t.hoursWorked)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(t.income, currency)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Feedback snapshot */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Feedback inbox</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/feedback">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {overviewLoading || !overview ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Badge variant="warning">
                      {overview.feedback.openCount} open
                    </Badge>
                    <Badge variant="success">
                      {overview.feedback.resolvedCount} resolved
                    </Badge>
                  </div>
                  {overview.feedback.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No feedback yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {overview.feedback.recent.map((f) => {
                        const meta = FEEDBACK_BADGE[f.type] ?? {
                          label: f.type,
                          variant: "secondary" as const,
                        };
                        return (
                          <li key={f.id} className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(f.createdAt)}
                              </span>
                            </div>
                            <p className="line-clamp-1 text-sm text-muted-foreground">
                              {f.message}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent tutors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent signups</CardTitle>
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {overviewLoading || !overview ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : overview.recentTutors.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No tutors yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {overview.recentTutors.map((t) => (
                    <li
                      key={t.tutorId}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Avatar className="size-7">
                        {t.avatarUrl && (
                          <AvatarImage src={t.avatarUrl} alt={t.name} />
                        )}
                        <AvatarFallback>{initials(t.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        {t.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {t.email}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(t.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
