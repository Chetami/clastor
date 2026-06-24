import { useEffect, useRef } from "react";

/**
 * Adds the `is-visible` class to a `.reveal` element when it scrolls into view.
 * Respects prefers-reduced-motion via CSS (the class becomes a no-op).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const targets = node.classList.contains("reveal")
      ? [node, ...Array.from(node.querySelectorAll<HTMLElement>(".reveal"))]
      : Array.from(node.querySelectorAll<HTMLElement>(".reveal"));

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px", ...options },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [options]);

  return ref;
}
