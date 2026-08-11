import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/features/auth/BrandMark";
import { saveSurvey } from "./survey-storage";
import { STEPS } from "./survey-options";
import { IntentStep } from "./steps/IntentStep";
import { DetailsStep } from "./steps/DetailsStep";
import { RevealStep } from "./steps/RevealStep";
import { WaitlistStep } from "./steps/WaitlistStep";
import {
  EMPTY_SURVEY,
  isOrgIntent,
  toSignupSurvey,
  type SurveyAnswers,
  type SurveyIntent,
} from "@examify-tms/shared";

export default function SignupSurveyPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>(EMPTY_SURVEY);
  const step = STEPS[stepIndex];

  function update(patch: Partial<SurveyAnswers>) {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }

  function pickIntent(intent: SurveyIntent) {
    update({ intent, studentCountBucket: null, tutorCountBucket: null });
  }

  const detailsComplete =
    answers.studentCountBucket !== null &&
    answers.tutoringFormat !== null &&
    answers.currentTools.length > 0 &&
    (!isOrgIntent(answers.intent) || answers.tutorCountBucket !== null);

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }

  function back() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function handleCreate() {
    saveSurvey(toSignupSurvey(answers));
    navigate("/signup/account");
  }

  const canAdvance =
    step === "intent"
      ? answers.intent !== null
      : step === "details"
        ? detailsComplete
        : true;

  return (
    <div className="relative flex min-h-svh flex-col bg-gradient-to-b from-accent/40 to-background">
      <div className="absolute top-4 left-4">
        <BrandMark size={40} />
      </div>
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>

      <div className="flex justify-center gap-2 pb-2 pt-16">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepIndex
                ? "w-8 bg-primary"
                : i < stepIndex
                  ? "w-2 bg-primary/60"
                  : "w-2 bg-muted-foreground/25"
            }`}
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-4 sm:px-6">
        <div key={step} className="survey-step-in">
          {step === "intent" && (
            <IntentStep answers={answers} onPick={pickIntent} />
          )}
          {step === "details" && <DetailsStep answers={answers} set={update} />}
          {step === "reveal" &&
            (isOrgIntent(answers.intent) ? (
              <WaitlistStep answers={answers} />
            ) : (
              <RevealStep answers={answers} onCreate={handleCreate} />
            ))}
        </div>

        {step !== "reveal" && (
          <div className="mt-8 flex items-center justify-between">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={back}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button
              onClick={next}
              disabled={!canAdvance}
              size="lg"
              className="text-base"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-1.5 pb-5 text-xs text-muted-foreground">
        Takes about 30 seconds
      </footer>
    </div>
  );
}
