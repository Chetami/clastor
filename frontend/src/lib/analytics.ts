/**
 * Provider-agnostic analytics helper.
 *
 * Funnel-critical events across the signup → onboarding flow call `track()`.
 * Events are buffered on `window.__clastorEvents` and logged in dev so a real
 * provider (PostHog, Segment, GA, …) can be wired in later by draining the
 * buffer or replacing the body of `track`. Keeping a single chokepoint means
 * every funnel transition flows through one place.
 */
type EventProps = Record<string, unknown>;

const BUFFER_KEY = "__clastorEvents";

function getBuffer(): EventProps[] | null {
  try {
    const w = window as unknown as { [BUFFER_KEY]?: EventProps[] };
    if (!w[BUFFER_KEY]) w[BUFFER_KEY] = [];
    return w[BUFFER_KEY] ?? null;
  } catch {
    return null;
  }
}

export function track(event: string, props: EventProps = {}): void {
  const buf = getBuffer();
  buf?.push({ event, ts: Date.now(), ...props });
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event, props);
  }
}

/** Remove and return all buffered events (used by a future provider flush). */
export function drainEvents(): EventProps[] {
  const buf = getBuffer();
  if (!buf) return [];
  const copy = [...buf];
  buf.length = 0;
  return copy;
}
