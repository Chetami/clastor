import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  CartesianGrid,
  XAxis,
  LabelList,
  ReferenceLine,
  type RenderableText,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserCurrency } from "@/lib/use-currency";
import type { DashboardSummaryResponse } from "@examify-tms/interfaces";
import {
  buildChartData,
  sum,
  mean,
  peak,
  todayBucketLabel,
  isDenseSeries,
  formatCurrencyWhole,
} from "../lib";

const chartConfig = {
  current: {
    label: "This period",
    color: "var(--primary)",
  },
  previous: {
    label: "Last period",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

export function IncomeChart({ summary }: { summary: DashboardSummaryResponse }) {
  const currency = useUserCurrency();
  const data = buildChartData(summary.incomeSeries, summary.previousIncomeSeries);
  const currents = data.map((d) => d.current);
  const total = sum(currents);
  const avg = mean(currents);
  const peakVal = peak(currents);
  const todayLabel = todayBucketLabel(summary.incomeSeries);
  const showLabels = !isDenseSeries(summary.incomeSeries);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const cur = Number(payload.find((p: { dataKey?: string | number; value?: number | string }) => p.dataKey === "current")?.value ?? 0);
    const prev = Number(payload.find((p: { dataKey?: string | number; value?: number | string }) => p.dataKey === "previous")?.value ?? 0);
    const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
    return (
      <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="mb-1 font-medium">{formatCurrencyWhole(cur, currency)}</div>
        <div className="text-muted-foreground">{pct}% of period</div>
        {prev > 0 && (
          <div className="text-muted-foreground">
            Last: {formatCurrencyWhole(prev, currency)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Income collected</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatCurrencyWhole(total, currency)} · avg {formatCurrencyWhole(avg, currency)} · peak{" "}
          {formatCurrencyWhole(peakVal, currency)}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 20, bottom: 0 }}>
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
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: `avg ${formatCurrencyWhole(avg, currency)}`,
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="var(--primary)"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
                label={{
                  value: "today",
                  position: "top",
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            )}

            <Bar dataKey="current" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.current >= avg && d.current > 0
                      ? "var(--color-current)"
                      : "color-mix(in oklch, var(--primary) 30%, transparent)"
                  }
                />
              ))}
              {showLabels && (
                <LabelList
                  dataKey="current"
                  position="top"
                  offset={8}
                  className="fill-muted-foreground"
                  fontSize={10}
                  formatter={(value: RenderableText) =>
                    Number(value) > 0 ? `$${Math.round(Number(value))}` : ""
                  }
                />
              )}
            </Bar>
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
