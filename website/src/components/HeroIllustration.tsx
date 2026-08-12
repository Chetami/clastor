/**
 * Hero scene illustration — a tutor teaching a student at a desk.
 *
 * Rendered absolutely over the HeroMockup so the desk in the illustration can
 * be lined up with the top edge of the platform card. All placement is done
 * with inline styles for pixel-precise control: tweak the values in POSITION
 * below to move, resize, or rotate the illustration.
 *
 * IMPORTANT: this component must sit inside a `position: relative` container.
 * In Hero.tsx it is placed as a sibling of <HeroMockup /> inside a relative
 * div, so `top: 0` == the mockup's top edge, and `right: 0` == the mockup's
 * right edge.
 */

// ── Tweak these to position the illustration ──────────────────────────
// All units are px (except `rotate`, which is degrees). Because the source is
// square, rendered height always equals `width`.
const POSITION = {
  /**
   * Distance from the mockup's TOP edge.
   * Negative lifts the illustration up so it sits above the card. To rest the
   * desk on the card's top edge, start near `-width` (e.g. width 160 → top
   * ~ -150 to tuck the desk ~10px onto the card) and nudge from there.
   */
  top: -163,
  /**
   * Distance from the mockup's RIGHT edge. Negative pushes the illustration
   * off the right side of the card; positive moves it inward.
   */
  right: 16,
  /** Rendered width. Height matches (square source). */
  width: 220,
  /** Tilt in degrees for a hand-placed feel. 0 = upright. */
  rotate: 0,
  /** Stack order — keep above the mockup card (10). */
  zIndex: 10,
} as const;
// ───────────────────────────────────────────────────────────────────────

export function HeroIllustration() {
  return (
    <img
      src="/illustration.png"
      alt="A tutor teaching a student at a desk"
      width={1024}
      height={1024}
      draggable={false}
      style={{
        position: "absolute",
        top: POSITION.top,
        right: POSITION.right,
        width: POSITION.width,
        height: "auto",
        transform: `rotate(${POSITION.rotate}deg)`,
        zIndex: POSITION.zIndex,
        userSelect: "none",
        // Lets hovers/clicks pass through to the mockup beneath.
        pointerEvents: "none",
      }}
    />
  );
}
