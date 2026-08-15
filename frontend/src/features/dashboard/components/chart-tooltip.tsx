import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";

interface DashboardTooltipProps extends TooltipContentProps {
  /** Period total — used for the "% of period" line (0 hides nothing). */
  total: number;
  /** Render the headline value (and the "Last:" comparison value). */
  format: (current: number, previous: number) => ReactNode;
}

/**
 * Shared tooltip body for the dashboard charts. Both charts plot a `current`
 * and a `previous` series and differ only in how values are formatted —
 * previously this was two copy-pasted `any`-typed renderers.
 */
export function DashboardTooltip({
  active,
  payload,
  total,
  format,
}: DashboardTooltipProps) {
  if (!active || !payload?.length) return null;
  const cur = Number(
    payload.find((p) => p.dataKey === "current")?.value ?? 0,
  );
  const prev = Number(
    payload.find((p) => p.dataKey === "previous")?.value ?? 0,
  );
  const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium">{format(cur, prev)}</div>
      <div className="text-muted-foreground">{pct}% of period</div>
      {prev > 0 && (
        <div className="text-muted-foreground">Last: {format(prev, 0)}</div>
      )}
    </div>
  );
}
