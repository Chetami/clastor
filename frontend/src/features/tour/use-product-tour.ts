import { useCallback, useRef } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
import { useNavigate } from "react-router-dom";

import { TOUR_STEPS } from "./tour-steps";
import { waitForSelector } from "./wait-for-selector";
import { useMarkTourSeen } from "./api/use-mark-tour-seen";

// Module-level guard prevents double-start under React StrictMode or rapid
// remounts; only one driver instance should be on screen at a time.
let tourActive = false;

/**
 * Drives the product tour. `start()` begins at the dashboard and walks the
 * steps in {@link TOUR_STEPS}, route-hopping as needed. Because react-router
 * navigation is async, Next/Prev handlers await the target route's anchor
 * element before telling driver.js to move on.
 */
export function useProductTour() {
  const navigate = useNavigate();
  const markTourSeen = useMarkTourSeen();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const start = useCallback(async () => {
    if (tourActive || driverRef.current?.isActive()) return;
    tourActive = true;

    // Navigate to the target route (if different) and wait for the step's
    // anchor element to mount before highlighting.
    const ensureReady = async (route?: string, element?: string) => {
      if (route && window.location.pathname !== route) {
        navigate(route);
      }
      if (element) await waitForSelector(element);
    };

    const steps: DriveStep[] = TOUR_STEPS.map((s) => ({
      element: s.element,
      popover: { title: s.popover.title, description: s.popover.description },
    }));

    const config: Config = {
      showProgress: true,
      allowClose: true,
      progressText: "{{current}} of {{total}}",
      prevBtnText: "Back",
      nextBtnText: "Next",
      doneBtnText: "Done",
      popoverClass: "clastor-tour",
      overlayColor: "#000000",
      overlayOpacity: 0.5,
      stagePadding: 6,
      stageRadius: 8,
      steps,
      onNextClick: async (_el, _step, opts) => {
        const current = opts.driver.getActiveIndex() ?? 0;
        const next = TOUR_STEPS[current + 1];
        if (next) await ensureReady(next.route, next.element);
        opts.driver.moveNext();
      },
      onPrevClick: async (_el, _step, opts) => {
        const current = opts.driver.getActiveIndex() ?? 0;
        const prev = TOUR_STEPS[current - 1];
        if (prev) await ensureReady(prev.route, prev.element);
        opts.driver.movePrevious();
      },
      onCloseClick: (_el, _step, opts) => {
        opts.driver.destroy();
      },
      onDestroyed: () => {
        tourActive = false;
        driverRef.current = null;
        markTourSeen.mutate();
      },
    };

    // Always begin the tour from the dashboard so the early steps line up.
    await ensureReady("/dashboard");

    const driverObj = driver(config);
    driverRef.current = driverObj;
    driverObj.drive();
  }, [navigate, markTourSeen]);

  return { start };
}
