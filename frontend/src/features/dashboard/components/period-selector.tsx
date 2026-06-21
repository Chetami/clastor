import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DashboardPeriod } from "@examify-tms/interfaces";

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "six_months", label: "6M" },
  { value: "year", label: "Year" },
];

export function PeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as DashboardPeriod);
      }}
      variant="outline"
      size="sm"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroupItem key={opt.value} value={opt.value} aria-label={opt.label}>
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
