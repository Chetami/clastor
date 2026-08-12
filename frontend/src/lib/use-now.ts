import { useEffect, useState } from "react";

/**
 * Returns the current epoch ms and re-renders on an interval. Useful for
 * countdowns (cooldowns, "in 5 min" labels) that would otherwise freeze
 * because they capture `Date.now()` at render time.
 *
 * @param intervalMs how often to tick (default 60s).
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
