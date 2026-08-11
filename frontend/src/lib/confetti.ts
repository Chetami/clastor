import confetti from "canvas-confetti";

/**
 * "Side cannons" — a short burst of confetti fired from the two bottom
 * corners of the viewport, shooting up and inward. Sprays continuously via
 * requestAnimationFrame for `durationMs`. Use for finisher celebrations.
 *
 * Note: in canvas-confetti `origin.y` is 0 at the top and 1 at the bottom, so
 * the cannons use y: 1 to fire from the bottom of the screen.
 */
export function fireConfettiCannons(durationMs = 600) {
  const end = Date.now() + durationMs;
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 1 },
      colors,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 1 },
      colors,
    });
    requestAnimationFrame(frame);
  };

  frame();
}
