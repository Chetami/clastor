import {
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  LabelList,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummaryResponse } from "@examify-tms/interfaces";
import {
  buildChartData,
  sum,
  mean,
  peak,
  todayBucketLabel,
  isDenseSeries,
  formatHours,
} from "../lib";

const chartConfig = {
  current: {
    label: "This period",
    color: "hsl(var(--primary))",
  },
  previous: {
    label: "Last period",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig;

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
  label?: string | number;
};

export function HoursChart({ summary }: { summary: DashboardSummaryResponse }) {
  const data = buildChartData(summary.hoursSeries, summary.previousHoursSeries);
  const currents = data.map((d) => d.current);
  const total = sum(currents);
  const avg = mean(currents);
  const peakVal = peak(currents);
  const todayLabel = todayBucketLabel(summary.hoursSeries);
  const showLabels = !isDenseSeries(summary.hoursSeries);

  const renderTooltip = ({ active, payload }: TooltipProps) => {
    if (!active || !payload?.length) return null;
    const cur = Number(payload.find((p) => p.dataKey === "current")?.value ?? 0);
    const prev = Number(payload.find((p) => p.dataKey === "previous")?.value ?? 0);
    const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
    return (
      <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="mb-1 font-medium">{formatHours(cur)}</div>
        <div className="text-muted-foreground">{pct}% of period</div>
        {prev > 0 && (
          <div className="text-muted-foreground">
            Last: {formatHours(prev)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Hours taught</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatHours(total)} · avg {formatHours(avg)} · peak{" "}
          {formatHours(peakVal)}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={showLabels ? 0 : "preserveStartEnd"}
              minTickGap={showLabels ? undefined : 16}
              padding={{ left: 12, right: 12 }}
            />
            <ChartTooltip content={renderTooltip} cursor={false} />

            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: `avg ${formatHours(avg)}`,
                position: "insideTopRight",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
                label={{
                  value: "today",
                  position: "top",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                }}
              />
            )}

            <Area
              dataKey="current"
              type="monotone"
              stroke="var(--color-current)"
              strokeWidth={2}
              fill="url(#fillHours)"
            >
              {showLabels && (
                <LabelList
                  dataKey="current"
                  position="top"
                  offset={8}
                  className="fill-muted-foreground"
                  fontSize={10}
                  formatter={(value: number) =>
                    Number(value) > 0 ? String(Number(value).toFixed(1)) : ""
                  }
                />
              )}
            </Area>
            <Line
              dataKey="previous"
              type="monotone"
              stroke="var(--color-previous)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
