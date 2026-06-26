import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import "./tour.css";
import { useAuthStore } from "@/store/auth-store";
import { useProductTour } from "./use-product-tour";

/**
 * Auto-runs the product tour once, the first time a user reaches the app
 * after finishing onboarding. It does nothing until `onboardingComplete` is
 * true (so the OnboardingBanner is already gone) and only on desktop-width
 * screens — mobile users get the replay entry point only.
 *
 * Renders nothing; this is a side-effect-only component mounted in the
 * dashboard layout.
 */
export function TourBoot() {
  const user = useAuthStore((s) => s.user);
  const { start } = useProductTour();
  const startRef = useRef(start);
  startRef.current = start;

  const ready =
    !!user &&
    user.role !== "system_admin" &&
    user.onboardingComplete &&
    !user.tourSeen;

  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    // Let the dashboard paint before we start highlighting elements.
    const t = window.setTimeout(() => {
      void startRef.current();
    }, 600);

    return () => window.clearTimeout(t);
  }, [ready]);

  return null;
}
