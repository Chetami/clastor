import { cn } from "@/lib/utils";

/**
 * Clastor wordmark with a hand-drawn "doodle" mark.
 * A rounded square with notebook-style lines and an orange dot accent —
 * a friendly nod to lists, schedules, and the things you tick off.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2.5"
          y="2.5"
          width="27"
          height="27"
          rx="8"
          fill="hsl(var(--card))"
          stroke="hsl(var(--foreground))"
          strokeWidth="2.5"
        />
        <path
          d="M9 11h14M9 16h9M9 21h11"
          stroke="hsl(var(--foreground))"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle
          cx="22"
          cy="21"
          r="3.2"
          fill="hsl(var(--brand))"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-xl tracking-tight",
          onDark ? "text-background" : "text-foreground",
        )}
      >
        Clastor
      </span>
    </span>
  );
}
