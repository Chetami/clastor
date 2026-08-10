import { Chip } from "../Chip";
import { Question } from "../Question";
import {
  FORMAT_OPTIONS,
  TOOL_OPTIONS,
  TUTOR_COUNT_OPTIONS,
} from "../survey-options";
import {
  BUCKETS_BY_INTENT,
  isOrgIntent,
  type SurveyAnswers,
} from "@examify-tms/shared";

export function DetailsStep({
  answers,
  set,
}: {
  answers: SurveyAnswers;
  set: (patch: Partial<SurveyAnswers>) => void;
}) {
  const org = isOrgIntent(answers.intent);
  const entity = org ? "organisation" : "tutoring";

  const bucketOptions = (
    answers.intent
      ? BUCKETS_BY_INTENT[answers.intent]
      : BUCKETS_BY_INTENT.exploring
  ).map((b) => {
    const label = b.replace("-", "\u2013").replace("+", "+");
    return { value: b, label };
  });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tell us about your {entity}
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        <Question
          label={
            org
              ? "How many students does your organisation teach?"
              : "How many students do you teach?"
          }
        >
          <div className="flex flex-wrap gap-2">
            {bucketOptions.map((opt) => (
              <Chip
                key={opt.value}
                selected={answers.studentCountBucket === opt.value}
                label={opt.label}
                onClick={() => set({ studentCountBucket: opt.value })}
              />
            ))}
          </div>
        </Question>

        {org && (
          <Question label="How many tutors are in your team?">
            <div className="flex flex-wrap gap-2">
              {TUTOR_COUNT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={answers.tutorCountBucket === opt.value}
                  label={opt.label}
                  onClick={() => set({ tutorCountBucket: opt.value })}
                />
              ))}
            </div>
          </Question>
        )}

        <Question label="How do you teach?">
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                selected={answers.tutoringFormat === opt.value}
                label={opt.label}
                onClick={() => set({ tutoringFormat: opt.value })}
              />
            ))}
          </div>
        </Question>

        <Question label="How do you manage things today?">
          <div className="flex flex-wrap gap-2">
            {TOOL_OPTIONS.map((opt) => {
              const selected = answers.currentTools.includes(opt.value);
              return (
                <Chip
                  key={opt.value}
                  selected={selected}
                  label={opt.label}
                  onClick={() =>
                    set({
                      currentTools: selected
                        ? answers.currentTools.filter((t) => t !== opt.value)
                        : [...answers.currentTools, opt.value],
                    })
                  }
                />
              );
            })}
          </div>
        </Question>
      </div>
    </div>
  );
}
