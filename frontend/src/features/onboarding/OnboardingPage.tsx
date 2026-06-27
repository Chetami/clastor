import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth-store";
import { useListStudents } from "@/features/students/api/use-list-students";
import { useListLessons } from "@/features/schedule/api/use-list-lessons";
import { useCompleteOnboarding } from "./api/use-complete-onboarding";
import { WelcomeStep } from "./steps/WelcomeStep";
import { SubjectsStep } from "./steps/SubjectsStep";
import { AddStudentStep } from "./steps/AddStudentStep";
import { ScheduleLessonStep } from "./steps/ScheduleLessonStep";
import { GoogleConnectStep } from "./steps/GoogleConnectStep";
import { FinishStep } from "./steps/FinishStep";

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "subjects", label: "Subjects" },
  { key: "student", label: "First student" },
  { key: "lesson", label: "First lesson" },
  { key: "google", label: "Calendar" },
  { key: "finish", label: "All set" },
] as const;

const GOOGLE_STEP_INDEX = STEPS.findIndex((s) => s.key === "google");
const STUDENT_STEP_INDEX = STEPS.findIndex((s) => s.key === "student");
const LESSON_STEP_INDEX = STEPS.findIndex((s) => s.key === "lesson");

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
  const studentsQuery = useListStudents();
  const hasStudents = (studentsQuery.data?.length ?? 0) > 0;
  const lessonsQuery = useListLessons();
  const hasLessons = (lessonsQuery.data?.length ?? 0) > 0;

  const [step, setStep] = useState<number>(() => {
    // Returning from the Google consent flow comes back with a `google` param;
    // resume on the calendar step so the success banner is visible there.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("google")) return GOOGLE_STEP_INDEX;
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
  // Onboarding is tutor-only — admins are bounced to the dashboard.
  useEffect(() => {
    if (user?.role !== "tutor" || user?.onboardingComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.role, user?.onboardingComplete, navigate]);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progressValue = ((step + 1) / STEPS.length) * 100;

  // Gated steps: the student step requires a student to exist, and the lesson
  // step requires a booked lesson (the next step is calendar/sync, but the
  // whole point of the wizard is to land that first lesson).
  const canAdvance =
    (step !== STUDENT_STEP_INDEX || hasStudents) &&
    (step !== LESSON_STEP_INDEX || hasLessons);

  const gateMessage =
    step === STUDENT_STEP_INDEX
      ? "Add a student to continue."
      : step === LESSON_STEP_INDEX
        ? "Book a lesson to continue."
        : null;

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
            {step === 1 && <SubjectsStep />}
            {step === 2 && <AddStudentStep />}
            {step === 3 && <ScheduleLessonStep />}
            {step === 4 && <GoogleConnectStep />}
            {step === 5 && <FinishStep />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {!isFirst ? (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

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
            <Button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canAdvance}
              title={!canAdvance ? gateMessage ?? undefined : undefined}
            >
              {step === 0 ? "Get started" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {!canAdvance && gateMessage && (
          <p className="text-center text-xs text-muted-foreground">
            {gateMessage}
          </p>
        )}

        {complete.isError && (
          <p className="text-center text-sm text-destructive">
            {complete.error.message}
          </p>
        )}
      </main>
    </div>
  );
}
