import { useEffect, useState } from "react";

/**
 * Returns whether a CSS media query currently matches, and updates on change.
 *
 * This site is a client-only Vite SPA, so the initial state is read
 * synchronously from `window.matchMedia` — the first paint is already correct
 * (no flash of the wrong value).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
