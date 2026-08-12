import { cn } from "@/lib/utils";

type DoodleProps = { className?: string };

/**
 * Reusable hand-drawn SVG marks for the "Doodle" design system.
 *
 * All marks use `stroke="currentColor"` (Sparkle uses `fill="currentColor"`)
 * so they tint via Tailwind text colour utilities — e.g. `text-brand`,
 * `text-foreground`, `text-muted-foreground`. Size them with `w-*`/`h-*`.
 *
 * Every mark is decorative: `aria-hidden="true"`, no focus, no role.
 */

/**
 * Hand-drawn underline. Stretches to container width
 * (`preserveAspectRatio="none"`) — pair with a full-width parent.
 */
export function Scribble({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 320 24"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <path d="M6 15 C 40 4, 70 4, 110 12 S 200 20, 250 10 S 312 6, 314 14" />
    </svg>
  );
}

/** Hand-drawn right-pointing arrow. Rotate via `rotate-*` to repoint. */
export function Arrow({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 140 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 22 C 32 15, 58 29, 86 21 S 116 18, 128 22 M128 22 L 116 14 M128 22 L 116 30" />
    </svg>
  );
}

/** Four-point sparkle. Filled with `currentColor` — the classic accent burst. */
export function Sparkle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 3 C 25.5 17, 28 20.5, 45 24 C 28 27.5, 25.5 31, 24 45 C 22.5 31, 20 27.5, 3 24 C 20 20.5, 22.5 17, 24 3 Z" />
    </svg>
  );
}

/** Five-point star, drawn as a friendly outline. */
export function Star({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 4 L29.5 18.5 L45 19 L33 29 L37 44.5 L24 35.5 L11 44.5 L15 29 L3 19 L18.5 18.5 Z" />
    </svg>
  );
}

/**
 * Wobbly oval for circling a word or phrase. Absolute-position it over text
 * (e.g. behind a heading) with a low opacity so it reads as a highlighter.
 */
export function Circle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 220 90"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 46 C 8 24, 52 9, 112 10 C 172 11, 212 25, 204 48 C 210 70, 166 83, 108 81 C 50 83, 20 67, 16 46 Z" />
    </svg>
  );
}

/** Even sine wave — usable as a thin divider or inline accent. */
export function Squiggle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 200 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12 Q 14 3, 24 12 T 44 12 T 64 12 T 84 12 T 104 12 T 124 12 T 144 12 T 164 12 T 184 12 T 196 12" />
    </svg>
  );
}

/** Six-spoke hand-drawn asterisk — small footnote / call-out accent. */
export function Asterisk({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5 C 11.5 9, 12.5 15, 12 20.5 M4.8 7.5 C 9 9.5, 14 14, 19.2 16.5 M19.2 7.5 C 15 9.5, 10 14, 4.8 16.5" />
    </svg>
  );
}

/** Hand-drawn heart. */
export function Heart({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 48 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 41 C 9 30, 4 19, 10 11 C 15 5, 23 7, 24 15 C 25 7, 33 5, 38 11 C 44 19, 39 30, 24 41 Z" />
    </svg>
  );
}
