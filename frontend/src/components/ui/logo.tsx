import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

/**
 * Clastor hand-drawn "doodle" mark — a rounded card with notebook-style lines
 * and an orange dot accent. Rendered inline with theme tokens so it adapts to
 * the active appearance (light/dark) and color scheme. Mirrors the mark used on
 * the marketing site and the favicon (public/logo.svg).
 */
export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="8"
        fill="var(--card)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
      />
      <path
        d="M9 11h14M9 16h9M9 21h11"
        stroke="var(--foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle
        cx="22"
        cy="21"
        r="3.2"
        fill="var(--primary)"
        stroke="var(--foreground)"
        strokeWidth="2"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 40 }: LogoProps) {
  return <LogoMark className={className} size={size} />;
}
