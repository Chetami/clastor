import { ChevronDown, ChevronUp } from "lucide";
import { MorphIcon } from "morphicons/react";

import { cn } from "@/lib/utils";

interface MorphChevronProps {
  open: boolean;
  className?: string;
  size?: number;
}

/**
 * Expand/collapse chevron that morphs between down (closed) and up (open)
 * instead of rotating a single icon 180°. `text-*` colour utilities on
 * `className` colour the stroke (MorphIcon strokes with currentColor).
 */
export function MorphChevron({ open, className, size = 16 }: MorphChevronProps) {
  return (
    <MorphIcon
      icon={open ? ChevronUp : ChevronDown}
      size={size}
      spring="snappy"
      className={cn("text-muted-foreground", className)}
    />
  );
}
