import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudentStatsPeriod } from "@examify-tms/shared";

const PERIODS: { value: StudentStatsPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "six_months", label: "Last 6 months" },
  { value: "year", label: "This year" },
];

/** Period picker for lesson stats — shared by the list and detail pages. */
export function StatsPeriodSelect({
  value,
  onChange,
  className,
}: {
  value: StudentStatsPeriod;
  onChange: (period: StudentStatsPeriod) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as StudentStatsPeriod)}
    >
      <SelectTrigger aria-label="Stats period" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}