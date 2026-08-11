import { cn } from "@/lib/utils";

/**
 * Clastor wordmark with an abstract mark.
 * The mark is three organized bars of varying height — a calm nod to
 * schedules, growth, and order. Deliberately not a graduation cap.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="7" y="16" width="4" height="9" rx="2" fill="currentColor" />
        <rect x="14" y="11" width="4" height="14" rx="2" fill="currentColor" />
        <rect x="21" y="6" width="4" height="19" rx="2" fill="currentColor" />
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
