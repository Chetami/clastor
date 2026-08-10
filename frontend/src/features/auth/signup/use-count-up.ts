import { useEffect, useRef, useState } from "react";

/**
 * Count-up animation hook. Animates a number from 0 to `target` over
 * `duration` ms using an easeOutCubic curve. Returns 0 until `run` is true.
 */
export function useCountUp(
  target: number,
  duration = 900,
  run = true,
): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target * 10) / 10);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, run]);

  return value;
}
