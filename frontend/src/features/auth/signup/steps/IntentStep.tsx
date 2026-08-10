import { OptionCard } from "../OptionCard";
import { INTENT_OPTIONS } from "../survey-options";
import type { SurveyAnswers, SurveyIntent } from "@examify-tms/shared";

export function IntentStep({
  answers,
  onPick,
}: {
  answers: SurveyAnswers;
  onPick: (intent: SurveyIntent) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-7 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What brings you to Clastor?
        </h1>
        <p className="max-w-md text-muted-foreground">
          We'll tailor your setup to match. You can change anything later.
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3">
        {INTENT_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.value}
            selected={answers.intent === opt.value}
            icon={opt.icon}
            title={opt.title}
            subtitle={opt.subtitle}
            onClick={() => onPick(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}
