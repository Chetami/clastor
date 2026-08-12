import { UserPlus, CalendarCheck, Wallet, ArrowRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Arrow } from "@/components/Doodles";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";

interface Step {
  icon: LucideIcon;
  num: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: UserPlus,
    num: "1",
    title: "Add your students",
    description:
      "Import contacts or start fresh. Add billing rates, subjects, and guardian details once — they're reused everywhere.",
  },
  {
    icon: CalendarCheck,
    num: "2",
    title: "Schedule & track",
    description:
      "Block out the week. Recurring lessons, reminders, and calendar sync happen automatically — mark attendance in a tap.",
  },
  {
    icon: Wallet,
    num: "3",
    title: "Invoice & get paid",
    description:
      "Turn tracked lessons into a branded invoice in one click. Payment links and gentle reminders do the chasing for you.",
  },
];

const ROTATIONS = ["", "rotate-step-2", "rotate-step-3"];

export function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 px-5 py-24 sm:px-6 sm:py-28 lg:px-8"
    >
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Three steps from setup to paid.
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            You can be running in an afternoon. Most tutors send their first
            Clastor invoice the same day they sign up.
          </p>
        </div>

        <div className="relative">
          <div className="grid gap-5 md:grid-cols-3 md:gap-9">
            {STEPS.map((step, i) => (
              <StepCard key={step.num} step={step} index={i} rotate={ROTATIONS[i]} />
            ))}
          </div>
          {/* Hand-drawn flow arrows between steps (desktop only). */}
          <Arrow className="pointer-events-none absolute left-1/3 top-1/2 hidden h-6 w-9 -translate-x-1/2 -translate-y-1/2 text-brand/70 md:block" />
          <Arrow className="pointer-events-none absolute left-2/3 top-1/2 hidden h-6 w-9 -translate-x-1/2 -translate-y-1/2 text-brand/70 md:block" />
        </div>

        <div
          className="reveal mt-14 text-center"
          style={{ ["--reveal-delay" as string]: "120ms" }}
        >
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

function StepCard({
  step,
  index,
  rotate,
}: {
  step: Step;
  index: number;
  rotate: string;
}) {
  const Icon = step.icon;
  return (
    <article
      className={`reveal doodle-card flex flex-col gap-3.5 rounded-3xl p-7 ${rotate}`}
      style={{ ["--reveal-delay" as string]: `${index * 100}ms` }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-foreground bg-brand font-display text-lg text-foreground shadow-sketch">
        {step.num}
      </span>
      <Icon className="h-7 w-7 text-brand" strokeWidth={2.2} />
      <h3 className="mb-0.5 mt-0.5 font-display text-2xl">{step.title}</h3>
      <p className="text-base leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </article>
  );
}
