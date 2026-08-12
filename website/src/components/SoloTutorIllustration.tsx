import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Solo-tutor card illustration — the "happy_tutor" character.
 *
 * Rendered absolutely inside the "Run your tutoring like a business." card in
 * Audience.tsx, and clipped to that card by the wrapper div around it.
 *
 * Anchored from the card's BOTTOM edge so it stays glued to the bottom as the
 * card height changes. Placement is controlled per breakpoint via inline
 * styles for pixel-precise control. The solo card changes width across the
 * responsive layout (widest on tablet when single-column, narrower at `lg`
 * where it becomes the left grid column), so each breakpoint gets its own
 * number set in POSITIONS.
 *
 * IMPORTANT: must sit inside a `position: relative` container — the solo
 * <article> in Audience.tsx is `relative`, so `bottom: 0` == the card's bottom
 * edge and `right: 0` == the card's right edge.
 */

type Position = {
  /** Distance up from the card's BOTTOM edge (px). 0 = flush with the bottom. */
  bottom: number;
  /** Distance from the card's RIGHT edge (px). Negative pushes it off the card. */
  right: number;
  /** Rendered width (px). Height matches — the source is square. */
  width: number;
  /** Tilt in degrees. 0 = upright (the card itself is already tilted slightly). */
  rotate: number;
  /** Stack order. */
  zIndex: number;
};

// ── Tweak these per breakpoint ────────────────────────────────────────
// Tailwind breakpoints: base < 640px, sm ≥ 640px, lg ≥ 1024px.
const POSITIONS = {
  /** Mobile (<640px). Starting point — tune to taste. */
  base: {
    bottom: -9,
    right: 16,
    width: 104,
    rotate: 0,
    zIndex: 0,
  } satisfies Position,
  /** Tablet (≥640px). Single-column, so the card is wide. */
  sm: {
    bottom: -9,
    right: 24,
    width: 128,
    rotate: 0,
    zIndex: 0,
  } satisfies Position,
  /** Desktop (≥1024px). Card is the left grid column. */
  lg: {
    bottom: -10,
    right: 24,
    width: 128,
    rotate: 0,
    zIndex: 0,
  } satisfies Position,
} as const;
// ───────────────────────────────────────────────────────────────────────

export function SoloTutorIllustration() {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isSm = useMediaQuery("(min-width: 640px)");
  const p = isLg ? POSITIONS.lg : isSm ? POSITIONS.sm : POSITIONS.base;

  return (
    <img
      src="/happy_tutor.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: "absolute",
        bottom: p.bottom,
        right: p.right,
        width: p.width,
        height: "auto",
        transform: `rotate(${p.rotate}deg)`,
        zIndex: p.zIndex,
        userSelect: "none",
        // Lets hovers/clicks pass through to the card beneath.
        pointerEvents: "none",
      }}
    />
  );
}
