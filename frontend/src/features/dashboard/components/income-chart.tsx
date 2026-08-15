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
  type TooltipContentProps,
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
import { DashboardTooltip } from "./chart-tooltip";

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

  const renderTooltip = (props: TooltipContentProps) => (
    <DashboardTooltip
      {...props}
      total={total}
      format={(cur) => formatCurrencyWhole(cur, currency)}
    />
  );

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
                    Number(value) > 0
                      ? formatCurrencyWhole(Number(value), currency)
                      : ""
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
