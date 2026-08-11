import { UserPlus, CalendarCheck, Wallet, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";
import { ArrowRight } from "lucide-react";

interface Step {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: UserPlus,
    step: "01",
    title: "Add your students",
    description:
      "Add each student once — contact details, subject, rate, and timezone. Everything else just knows about them.",
  },
  {
    icon: CalendarCheck,
    step: "02",
    title: "Schedule & track",
    description:
      "Book one-off or recurring lessons. The calendar invite and reminder go out automatically, and progress is logged as you go.",
  },
  {
    icon: Wallet,
    step: "03",
    title: "Invoice & get paid",
    description:
      "At month's end, turn unpaid lessons into a polished invoice in a click. Students pay online — money lands in your account.",
  },
];

export function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border bg-secondary/40 py-24 sm:py-32"
    >
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-[1.1] tracking-tighter text-foreground sm:text-5xl">
            Up and running in{" "}
            <span className="display-accent">three steps.</span>
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            No setup marathon. You'll be scheduling your first lesson within
            minutes — Clastor is built to be simple.
          </p>
        </div>

        <div className="relative mt-16">
          {/* Connecting line (desktop) */}
          <div
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden="true"
          />

          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <StepItem key={step.step} step={step} index={i} />
            ))}
          </ol>
        </div>

        <div className="reveal mt-16 text-center" style={{ ["--reveal-delay" as string]: "120ms" }}>
          <Button asChild variant="brand" size="lg">
            <a href={APP_URL}>
              Start scheduling in minutes
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function StepItem({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <li
      className="reveal relative"
      style={{ ["--reveal-delay" as string]: `${index * 100}ms` }}
    >
      <div className="flex flex-col items-start">
        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Icon className="h-6 w-6 text-brand" />
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
            {step.step}
          </span>
        </div>
        <h3 className="mt-5 font-display text-xl tracking-tight text-foreground">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
    </li>
  );
}
