/**
 * PostHog-backed analytics helper.
 *
 * Every analytics event in the app flows through `track()`, which forwards to
 * PostHog via the `posthog-js` singleton initialized by `PostHogProvider` in
 * `main.tsx`. Captures made before the provider mounts are queued by the SDK
 * and flushed once it initializes. In dev, events are also logged to the
 * console. Keeping a single chokepoint means a provider swap only touches
 * this file.
 */
import posthog from "posthog-js";
import type { UserInfo } from "@examify-tms/interfaces";

type EventProps = Record<string, unknown>;

export function track(event: string, props: EventProps = {}): void {
  posthog.capture(event, props);
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event, props);
  }
}

/**
 * Link events to the signed-in user. Called by the auth-store sync effect in
 * `AppProvider` whenever the signed-in uid changes (login, signup, Google
 * sign-in, persisted-session boot) — never from call sites directly.
 */
export function identifyUser(user: UserInfo): void {
  posthog.identify(user.uid, {
    email: user.email,
    name: user.name,
    role: user.role,
    onboarding_complete: user.onboardingComplete,
  });
}

/**
 * Clear the PostHog identity (distinct id + person properties) so the next
 * person on this browser doesn't inherit the previous user's identity.
 */
export function resetAnalytics(): void {
  posthog.reset();
}
