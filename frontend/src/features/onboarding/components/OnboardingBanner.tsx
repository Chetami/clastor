import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { track } from "@/lib/analytics";

const DISMISS_KEY = "onboardingBannerDismissed";

/**
 * Dismissible nudge shown above the dashboard content while onboarding is
 * incomplete. "Complete setup" returns to the wizard; "Maybe later" hides the
 * banner for the rest of this browser session WITHOUT marking onboarding
 * complete — so `onboardingComplete` stays a clean signal of who actually
 * finished, and the nudge reappears next session for a genuine second chance.
 */
export function OnboardingBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Onboarding is tutor-only; admins never see this nudge.
  if (!user || user.onboardingComplete || user.role !== "tutor" || dismissed) {
    return null;
  }

  function dismiss() {
    track("onboarding_dismissed");
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Finish setting up your account</p>
          <p className="text-xs text-muted-foreground">
            Add your photo, currency and calendar to get the most out of Clastor.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Maybe later
        </Button>
        <Button size="sm" onClick={() => navigate("/onboarding")}>
          Complete setup
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
