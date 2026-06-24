import { UserPlus, CalendarCheck, Wallet, type LucideIcon } from "lucide-react";

import { SectionHeading } from "@/components/SectionHeading";
import { useReveal } from "@/hooks/useReveal";

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
    title: "Schedule lessons & track progress",
    description:
      "Book one-off or recurring lessons. The calendar invite and reminder go out automatically, and progress is logged as you go.",
  },
  {
    icon: Wallet,
    step: "03",
    title: "Send invoices and get paid",
    description:
      "At the end of the month, turn unpaid lessons into a polished invoice in a click. Students pay online — money lands in your account.",
  },
];

export function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border bg-secondary/40 py-24 sm:py-28"
    >
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
          description="No setup marathon. Clastor is built to be simple — you'll be scheduling your first lesson within minutes."
        />

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
      </div>
    </section>
  );
}

function StepItem({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <li
      className="reveal relative"
      style={{ ["--reveal-delay" as string]: `${index * 90}ms` }}
    >
      <div className="flex flex-col items-start">
        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <Icon className="h-6 w-6 text-brand" />
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
            {step.step}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
    </li>
  );
}
