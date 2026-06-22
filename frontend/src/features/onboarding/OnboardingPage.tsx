import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth-store";
import { useCompleteOnboarding } from "./api/use-complete-onboarding";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ProfileStep } from "./steps/ProfileStep";
import { GoogleConnectStep } from "./steps/GoogleConnectStep";

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "profile", label: "Profile" },
  { key: "google", label: "Calendar" },
] as const;

const STEP_STORAGE_KEY = "onboardingStep";

function readStoredStep(): number {
  try {
    const raw = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  } catch {
    return 0;
  }
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState<number>(() => {
    // Returning from the Google consent flow comes back with a `google` param;
    // resume on the calendar step so the success banner is visible there.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("google")) return STEPS.length - 1;
    }
    return readStoredStep();
  });

  // Persist current step so a page reload (e.g. the Google OAuth redirect)
  // resumes the wizard where the user left off.
  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_STORAGE_KEY, String(step));
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [step]);

  // If onboarding is already complete, there's nothing to do here.
  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.onboardingComplete, navigate]);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progressValue = ((step + 1) / STEPS.length) * 100;

  function skipToDashboard() {
    // Leave the wizard without completing; the dashboard banner will nudge
    // them to come back. Step stays persisted so they resume in place.
    navigate("/dashboard");
  }

  async function handleFinish() {
    try {
      await complete.mutateAsync();
      try {
        sessionStorage.removeItem(STEP_STORAGE_KEY);
      } catch {
        // ignore
      }
      navigate("/dashboard");
    } catch {
      // error surfaced via mutation state
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">Clastor</span>
        <Button variant="ghost" size="sm" onClick={skipToDashboard}>
          Skip for now
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step].label}</span>
          </div>
          <Progress value={progressValue} />
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 0 && <WelcomeStep />}
            {step === 1 && <ProfileStep />}
            {step === 2 && <GoogleConnectStep />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            disabled={isFirst}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {isLast ? (
            <Button onClick={handleFinish} disabled={complete.isPending}>
              {complete.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Finish
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {step === 0 ? "Get started" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {complete.isError && (
          <p className="text-center text-sm text-destructive">
            {complete.error.message}
          </p>
        )}
      </main>
    </div>
  );
}
