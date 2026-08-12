import { useCallback, useEffect, useRef, useState } from "react";
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
import { useAuthStore } from "@/store/auth-store";
import { useListStudents } from "@/features/students/api/use-list-students";
import { useListLessons } from "@/features/schedule/api/use-list-lessons";
import { useSubjects } from "@/lib/subjects";
import { track } from "@/lib/analytics";
import { useCompleteOnboarding } from "./api/use-complete-onboarding";
import { clearDrafts } from "./draft-storage";
import { WelcomeStep } from "./steps/WelcomeStep";
import { SubjectsStep } from "./steps/SubjectsStep";
import {
  AddStudentStep,
  type AddStudentStepHandle,
} from "./steps/AddStudentStep";
import { ScheduleLessonStep, type ScheduleLessonStepHandle } from "./steps/ScheduleLessonStep";
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
const SUBJECTS_STEP_INDEX = STEPS.findIndex((s) => s.key === "subjects");

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
  const subjects = useSubjects();
  const hasSubjects = subjects.length > 0;

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

  // Funnel: record each step the user lands on.
  useEffect(() => {
    track("onboarding_step", { step: STEPS[step].key, index: step });
  }, [step]);

  // Onboarding is tutor-only. Admins never get the tutor-flavoured wizard, so
  // if one lands here with an incomplete flag, mark them complete (they have
  // no path to finish it otherwise) and bounce to the dashboard. Tutors who
  // are already done also leave.
  const adminCompletionStarted = useRef(false);
  useEffect(() => {
    if (user?.role === "system_admin") {
      if (!user.onboardingComplete && !adminCompletionStarted.current) {
        adminCompletionStarted.current = true;
        complete.mutate();
      }
      navigate("/dashboard", { replace: true });
      return;
    }
    if (user?.role !== "tutor" || user?.onboardingComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.role, user?.onboardingComplete, navigate, complete]);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progressValue = ((step + 1) / STEPS.length) * 100;

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
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, []);

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
            {step === 2 && (
              <AddStudentStep
                ref={studentStepRef}
                hasStudents={hasStudents}
                onAdvance={advance}
                onStateChange={handleStudentState}
              />
            )}
            {step === 3 && (
              <ScheduleLessonStep
                ref={lessonStepRef}
                hasLessons={hasLessons}
                onAdvance={advance}
                onStateChange={handleLessonState}
              />
            )}
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
          ) : (step === STUDENT_STEP_INDEX && studentAutoAdvance) ||
            (step === LESSON_STEP_INDEX && lessonAutoAdvance) ? (
            <div />
          ) : step === STUDENT_STEP_INDEX && studentPhase === "form" ? (
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
          ) : step === LESSON_STEP_INDEX && lessonPhase === "form" ? (
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
            <Button onClick={advance} disabled={!hasSubjects && step === SUBJECTS_STEP_INDEX}>
              {step === 0 ? "Get started" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {step === STUDENT_STEP_INDEX &&
          studentPhase === "form" &&
          studentError && (
            <p className="text-center text-xs text-destructive">
              {studentError}
            </p>
          )}

        {step === LESSON_STEP_INDEX &&
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
