import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useCompleteOnboarding } from "../api/use-complete-onboarding";

/**
 * Dismissible nudge shown above the dashboard content while onboarding is
 * incomplete. "Complete setup" returns to the wizard; "Maybe later" marks
 * onboarding complete (so we stop nagging) without forcing the wizard.
 */
export function OnboardingBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const complete = useCompleteOnboarding();

  // Onboarding is tutor-only; admins never see this nudge.
  if (!user || user.onboardingComplete || user.role !== "tutor") return null;

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
        <Button
          variant="ghost"
          size="sm"
          disabled={complete.isPending}
          onClick={() => complete.mutate()}
        >
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
