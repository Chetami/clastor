import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudentStats, StudentStatsPeriod } from "@examify-tms/shared";
import { StatsPeriodSelect } from "./StatsPeriodSelect";

type Props = {
  stats: StudentStats;
  period: StudentStatsPeriod;
  onPeriodChange: (period: StudentStatsPeriod) => void;
  isLoading: boolean;
};

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: "warning";
}) {
  return (
    <div className="space-y-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "warning"
            ? "text-xl font-semibold text-amber-600 dark:text-amber-400"
            : "text-xl font-semibold"
        }
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const pct = (rate: number | null) =>
  rate === null ? null : `${Math.round(rate * 100)}%`;

/** Lesson outcome rollup for one student — disruptions, attendance, no-shows. */
export function StudentStatsCard({
  stats,
  period,
  onPeriodChange,
  isLoading,
}: Props) {
  const resolved = stats.attended + stats.noShows;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Lesson stats</CardTitle>
        <StatsPeriodSelect
          value={period}
          onChange={onPeriodChange}
          className="w-36"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-md" />
            ))}
          </div>
        ) : (
          <>
            {stats.warning && stats.noShowRate !== null && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <span className="font-medium">High no-show rate</span> —
                  missed {pct(stats.noShowRate)} of resolved lessons (
                  {stats.noShows} of {resolved}).
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              <Tile
                label="Disruptions"
                value={String(stats.disruptions)}
                sub={
                  stats.disruptions > 0
                    ? `${pct(stats.disruptionRate)} of lessons`
                    : null
                }
                tone={stats.disruptions > 0 ? "warning" : undefined}
              />
              <Tile
                label="Attended"
                value={String(stats.attended)}
                sub={
                  stats.attendedRate !== null
                    ? `${pct(stats.attendedRate)} of resolved${
                        stats.late > 0 ? ` · ${stats.late} late` : ""
                      }`
                    : null
                }
              />
              <Tile label="No-shows" value={String(stats.noShows)} />
              <Tile label="Tutor cancels" value={String(stats.tutorCancels)} />
              <Tile label="Declined" value={String(stats.declined)} />
              <Tile label="Lessons" value={String(stats.total)} />
              <Tile label="Upcoming" value={String(stats.upcoming)} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}