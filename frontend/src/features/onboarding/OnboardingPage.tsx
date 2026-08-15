import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  Loader2,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BrandMark } from "@/features/auth/BrandMark";
import { verifyRequest } from "@/features/auth/api";
import { useAuthStore } from "@/store/auth-store";
import { useListStudents } from "@/features/students/api/use-list-students";
import { useListLessons } from "@/features/schedule/api/use-list-lessons";
import { useSubjects } from "@/lib/subjects";
import { track } from "@/lib/analytics";
import { useCompleteOnboarding } from "./api/use-complete-onboarding";
import { clearDrafts } from "./draft-storage";
import {
  STEPS,
  STEP_KEYS,
  STEP_STORAGE_KEY,
  readStoredStep,
  resolveStepIndex,
  resolveInitialStep,
  type StepKey,
} from "./onboarding-steps";
import { WelcomeStep } from "./steps/WelcomeStep";
import { SubjectsStep } from "./steps/SubjectsStep";
import {
  AddStudentStep,
  type AddStudentStepHandle,
} from "./steps/AddStudentStep";
import { ScheduleLessonStep, type ScheduleLessonStepHandle } from "./steps/ScheduleLessonStep";
import { GoogleConnectStep } from "./steps/GoogleConnectStep";
import { FinishStep } from "./steps/FinishStep";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const complete = useCompleteOnboarding();
  const studentsQuery = useListStudents();
  const hasStudents = (studentsQuery.data?.length ?? 0) > 0;
  const lessonsQuery = useListLessons();
  const hasLessons = (lessonsQuery.data?.length ?? 0) > 0;
  const subjects = useSubjects();
  const hasSubjects = subjects.length > 0;

  // Tutors who already granted Calendar access (e.g. during Google signup)
  // skip the connect step entirely.
  const googleConnected = user?.googleConnected === true;
  const steps = useMemo<readonly StepKey[]>(
    () =>
      googleConnected
        ? STEP_KEYS.filter((k) => k !== "google")
        : [...STEP_KEYS],
    [googleConnected],
  );

  const [stepKey, setStepKey] = useState<StepKey>(() =>
    typeof window !== "undefined"
      ? resolveInitialStep(
          new URLSearchParams(window.location.search),
          readStoredStep(),
        )
      : readStoredStep(),
  );

  const stepIndex = resolveStepIndex(stepKey, steps);
  const activeKey = steps[stepIndex];

  // Refresh the signed-in user once on mount: returning from the Google OAuth
  // redirect, the store still holds the pre-consent user (the connection is
  // written server-side), so `googleConnected` would otherwise be stale.
  const userRefreshStarted = useRef(false);
  useEffect(() => {
    if (userRefreshStarted.current) return;
    userRefreshStarted.current = true;
    verifyRequest()
      .then(setUser)
      .catch(() => {
        // non-fatal — the wizard still works with the stored user
      });
  }, [setUser]);

  // Persist current step so a page reload (e.g. the Google OAuth redirect)
  // resumes the wizard where the user left off.
  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_STORAGE_KEY, stepKey);
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [stepKey]);

  // Funnel: record each step the user lands on.
  useEffect(() => {
    track("onboarding_step", { step: activeKey, index: stepIndex });
  }, [activeKey, stepIndex]);

  // Tutors who are already done leave. (Role guarding happens in
  // TutorRoute — this page is only ever mounted for tutors.)
  useEffect(() => {
    if (user?.role !== "tutor" || user?.onboardingComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.role, user?.onboardingComplete, navigate]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progressValue = ((stepIndex + 1) / steps.length) * 100;

  // The "Add student" / "Book lesson" actions live in the footer and are
  // driven by each step via an imperative handle. Each step reports its phase
  // (form vs. animated success), readiness, and pending/error state so the
  // footer button can reflect them — and so we can hide it while a success
  // animation auto-advances.
  const studentStepRef = useRef<AddStudentStepHandle>(null);
  const [studentPhase, setStudentPhase] = useState<"form" | "success">("form");
  const [studentAutoAdvance, setStudentAutoAdvance] = useState(false);
  const [studentCanSubmit, setStudentCanSubmit] = useState(false);
  const [studentPending, setStudentPending] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const handleStudentState = useCallback(
    (s: {
      phase: "form" | "success";
      autoAdvance: boolean;
      canSubmit: boolean;
      isPending: boolean;
      error: string | null;
    }) => {
      setStudentPhase(s.phase);
      setStudentAutoAdvance(s.autoAdvance);
      setStudentCanSubmit(s.canSubmit);
      setStudentPending(s.isPending);
      setStudentError(s.error);
    },
    [],
  );

  const lessonStepRef = useRef<ScheduleLessonStepHandle>(null);
  const [lessonPhase, setLessonPhase] = useState<"form" | "success">("form");
  const [lessonAutoAdvance, setLessonAutoAdvance] = useState(false);
  const [lessonCanSubmit, setLessonCanSubmit] = useState(false);
  const [lessonPending, setLessonPending] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const handleLessonState = useCallback(
    (s: {
      phase: "form" | "success";
      autoAdvance: boolean;
      canSubmit: boolean;
      isPending: boolean;
      error: string | null;
    }) => {
      setLessonPhase(s.phase);
      setLessonAutoAdvance(s.autoAdvance);
      setLessonCanSubmit(s.canSubmit);
      setLessonPending(s.isPending);
      setLessonError(s.error);
    },
    [],
  );

  function skipToDashboard() {
    // Leave the wizard without completing; the dashboard banner will nudge
    // them to come back. Step stays persisted so they resume in place.
    track("onboarding_skip");
    navigate("/dashboard");
  }

  async function handleFinish() {
    try {
      await complete.mutateAsync();
      track("onboarding_complete");
      try {
        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.removeItem("onboardingConfettiFired");
        clearDrafts();
      } catch {
        // ignore
      }
      navigate("/dashboard");
    } catch {
      // error surfaced via mutation state
    }
  }

  const advance = useCallback(() => {
    setStepKey(steps[Math.min(steps.length - 1, stepIndex + 1)]);
  }, [steps, stepIndex]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <BrandMark size={32} />
        <Button variant="ghost" size="sm" onClick={skipToDashboard}>
          Skip for now
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {stepIndex + 1} of {steps.length}
            </span>
            <span>{STEPS.find((s) => s.key === activeKey)?.label}</span>
          </div>
          <Progress value={progressValue} />
        </div>

        <Card>
          <CardContent className="p-6">
            {activeKey === "welcome" && <WelcomeStep />}
            {activeKey === "subjects" && <SubjectsStep />}
            {activeKey === "student" && (
              <AddStudentStep
                ref={studentStepRef}
                hasStudents={hasStudents}
                onAdvance={advance}
                onStateChange={handleStudentState}
              />
            )}
            {activeKey === "lesson" && (
              <ScheduleLessonStep
                ref={lessonStepRef}
                hasLessons={hasLessons}
                onAdvance={advance}
                onStateChange={handleLessonState}
              />
            )}
            {activeKey === "google" && <GoogleConnectStep />}
            {activeKey === "finish" && <FinishStep />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {!isFirst ? (
            <Button
              variant="ghost"
              onClick={() => setStepKey(steps[Math.max(0, stepIndex - 1)])}
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
          ) : (activeKey === "student" && studentAutoAdvance) ||
            (activeKey === "lesson" && lessonAutoAdvance) ? (
            <div />
          ) : activeKey === "student" && studentPhase === "form" ? (
            <Button
              onClick={() => studentStepRef.current?.submit()}
              disabled={!studentCanSubmit || studentPending}
            >
              {studentPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Add student
            </Button>
          ) : activeKey === "lesson" && lessonPhase === "form" ? (
            <Button
              onClick={() => lessonStepRef.current?.submit()}
              disabled={!lessonCanSubmit || lessonPending}
            >
              {lessonPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarPlus className="size-4" />
              )}
              Book lesson
            </Button>
          ) : (
            <Button
              onClick={advance}
              disabled={!hasSubjects && activeKey === "subjects"}
            >
              {isFirst ? "Get started" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {activeKey === "student" &&
          studentPhase === "form" &&
          studentError && (
            <p className="text-center text-xs text-destructive">
              {studentError}
            </p>
          )}

        {activeKey === "lesson" &&
          lessonPhase === "form" &&
          lessonError && (
            <p className="text-center text-xs text-destructive">
              {lessonError}
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
