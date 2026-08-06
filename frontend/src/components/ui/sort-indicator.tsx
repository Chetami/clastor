import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide";
import { MorphIcon } from "morphicons/react";

import { cn } from "@/lib/utils";

interface SortIndicatorProps {
  active: boolean;
  ascending: boolean;
  className?: string;
}

/**
 * Sortable column-header direction indicator. Morphs between the three states
 * (inactive / ascending / descending) via morphicons so the direction flip is
 * animated instead of an instant swap.
 */
export function SortIndicator({ active, ascending, className }: SortIndicatorProps) {
  const icon = active ? (ascending ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <MorphIcon
      icon={icon}
      size={12}
      spring="snappy"
      className={cn(
        "transition-opacity",
        !active && "opacity-0 group-hover:opacity-50",
        className,
      )}
    />
  );
}
