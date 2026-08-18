import { useEffect } from "react";
import { Check } from "lucide-react";

import { fireConfettiCannons } from "@/lib/confetti";
import { FoundersContactCard } from "../components/FoundersContactCard";

/**
 * Final step. Celebrates completion and reinforces the personal touch with
 * the founders contact card — the payoff of the one-line mention on the
 * welcome step. Copy stays generic about what was set up so it holds true
 * for tutors who connected Google during signup or arrived with existing
 * data. The wizard's "Finish" button (owned by the page) marks onboarding
 * complete and sends them to the dashboard.
 */
const CONFETTI_KEY = "onboardingConfettiFired";

export function FinishStep() {
  // Fire the confetti cannons once per browser session — Back→forward remounts
  // this step, so without this guard it would fire again each time.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CONFETTI_KEY)) return;
      sessionStorage.setItem(CONFETTI_KEY, "1");
    } catch {
      // ignore — fall through and still fire once this mount
    }
    fireConfettiCannons();
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          You're all set!
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Everything you set up is organised and waiting on your dashboard.
          From here, Clastor grows with your tutoring.
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-3">
        {[
          "Students, organised",
          "Lessons, scheduled",
          "Invoices, ready to send",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium"
          >
            <Check className="size-4 text-emerald-500" />
            {item}
          </div>
        ))}
      </div>

      <FoundersContactCard />
    </div>
  );
}
