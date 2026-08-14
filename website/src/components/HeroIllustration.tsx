import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Hero scene illustration — a tutor teaching a student at a desk.
 *
 * Rendered absolutely over the HeroMockup so the desk in the illustration can
 * be lined up with the top edge of the platform card. Hidden on the smallest
 * screens (it would crowd the narrow mockup) and scaled per breakpoint.
 * Because the source is square, rendered height always equals `width`.
 *
 * IMPORTANT: this component must sit inside a `position: relative` container.
 * In Hero.tsx it is placed as a sibling of <HeroMockup /> inside a relative
 * div, so `top: 0` == the mockup's top edge, and `right: 0` == the mockup's
 * right edge.
 */

type Position = {
  /**
   * Distance from the mockup's TOP edge. Negative lifts the illustration up
   * so it sits above the card. To rest the desk on the card's top edge, start
   * near `-width` and nudge from there.
   */
  top: number;
  /** Distance from the mockup's RIGHT edge. Negative pushes it off the card. */
  right: number;
  /** Rendered width. Height matches (square source). */
  width: number;
};

// ── Tweak these per breakpoint to position the illustration ──────────
// Tailwind breakpoints: base < 640px, sm ≥ 640px, lg ≥ 1024px.
const POSITIONS = {
  /** Mobile (<640px). Not rendered — the mockup is too narrow. */
  base: null,
  /** Tablet (≥640px). */
  sm: {
    top: -110,
    right: 16,
    width: 150,
  } satisfies Position,
  /** Desktop (≥1024px). */
  lg: {
    top: -163,
    right: 16,
    width: 220,
  } satisfies Position,
} as const;
// ───────────────────────────────────────────────────────────────────────

export function HeroIllustration() {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isSm = useMediaQuery("(min-width: 640px)");
  const p = isLg ? POSITIONS.lg : isSm ? POSITIONS.sm : POSITIONS.base;

  if (!p) return null;

  return (
    <img
      src="/hero_tutor.png"
      alt="A tutor teaching a student at a desk"
      width={1024}
      height={1024}
      draggable={false}
      style={{
        position: "absolute",
        top: p.top,
        right: p.right,
        width: p.width,
        height: "auto",
        zIndex: 10,
        userSelect: "none",
        // Lets hovers/clicks pass through to the mockup beneath.
        pointerEvents: "none",
      }}
    />
  );
}
