import { ArrowRight, BellRing, CalendarClock, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCountUp } from "../use-count-up";
import { estimateTimeSaved, type SurveyAnswers } from "@examify-tms/shared";

export function RevealStep({
  answers,
  onCreate,
}: {
  answers: SurveyAnswers;
  onCreate: () => void;
}) {
  const estimate = estimateTimeSaved(
    answers.studentCountBucket,
    answers.tutoringFormat,
  );
  const count = useCountUp(estimate.hoursPerWeek, 1000, true);
  const monthlyHours = Math.round(estimate.hoursPerWeek * 4.3);

  const intentLine =
    answers.intent === "exploring"
      ? "No commitment — explore the dashboard and add your first student when you're ready."
      : "Everything a solo tutor needs — scheduling, invoicing, and reminders, all automated.";

  const breakdown = [
    { icon: CalendarClock, label: "Scheduling", minutes: estimate.breakdown.scheduling },
    { icon: FileText, label: "Invoicing", minutes: estimate.breakdown.invoicing },
    { icon: BellRing, label: "Reminders", minutes: estimate.breakdown.reminders },
  ];

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Here's what Clastor gives back
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Based on your answers, you could reclaim time every week.
        </p>
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-end justify-center gap-1.5">
          <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl tabular-nums">
            {count.toFixed(1)}
          </span>
          <span className="pb-1.5 text-lg font-semibold text-muted-foreground">
            hrs / week
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          That's roughly{" "}
          <span className="font-medium text-foreground">
            {monthlyHours} hours a month
          </span>{" "}
          — time better spent teaching.
        </p>
      </div>

      <div className="flex w-full max-w-md items-stretch justify-center gap-2">
        {breakdown.map((row) => (
          <div
            key={row.label}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 shadow-sm"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <row.icon className="size-4" />
            </span>
            <span className="text-xs font-medium">{row.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.minutes} min
            </span>
          </div>
        ))}
      </div>

      <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
        {intentLine}
      </p>

      <Button
        size="lg"
        className="w-full max-w-md text-base"
        onClick={onCreate}
      >
        Create your free account
        <ArrowRight className="size-4" />
      </Button>
      <p className="text-xs text-muted-foreground">
        Takes under a minute. No credit card needed.
      </p>
    </div>
  );
}
