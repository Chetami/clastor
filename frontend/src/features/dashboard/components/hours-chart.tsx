import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummaryResponse } from "@examify-tms/interfaces";
import { formatHours } from "../lib";

const chartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function HoursChart({ summary }: { summary: DashboardSummaryResponse }) {
  const data = summary.hoursSeries.map((p) => ({
    label: p.label,
    hours: p.value,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Hours taught</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-hours)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-hours)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) => formatHours(Number(value))}
                />
              }
            />
            <Area
              dataKey="hours"
              type="monotone"
              stroke="var(--color-hours)"
              strokeWidth={2}
              fill="url(#fillHours)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
