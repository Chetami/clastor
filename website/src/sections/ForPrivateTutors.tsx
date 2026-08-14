import { Check, X } from "lucide-react";

import { Scribble, Sparkle, Star } from "@/components/Doodles";
import { useReveal } from "@/hooks/useReveal";

/**
 * Audience-contrast section.
 *
 * Sits straight after the hero to make Clastor's positioning unmistakable in
 * the first scroll: built for private tutors, NOT for tutoring centres /
 * agency software. Mirrors the differentiator in MARKETING.md §5 ("Built for
 * the individual tutor, not the enterprise").
 */
const NOT_FOR = [
  "Rosters for dozens of tutors",
  "Payroll and shift management",
  "Onboarding for a whole organisation",
  "Priced and built for companies",
];

const FOR_YOU = [
  "Built for one tutor — and a small team when you're ready",
  "Your students, schedule, and invoices in one place",
  "Set up in an afternoon, no migration project",
  "Free during beta, no card required",
];

export function ForPrivateTutors() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="relative scroll-mt-20 overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
      {/* Hand-drawn accents scattered in the margins. */}
      <Sparkle className="pointer-events-none absolute right-[6%] top-[12%] hidden h-8 w-8 rotate-12 text-brand/40 sm:block" />
      <Star className="pointer-events-none absolute left-[4%] bottom-[14%] hidden h-7 w-7 -rotate-6 text-warm sm:block" />

      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[680px] sm:mb-14">
          <p className="eyebrow">Who it's for</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Not another tool for{" "}
            <span className="display-accent relative inline-block">
              tutoring centres.
              <Scribble className="absolute left-0 top-[58%] h-[12px] w-full -translate-y-1/2 rotate-[-2deg] text-destructive" />
            </span>
          </h2>
          <p className="mt-3.5 max-w-[56ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            Tutor software is built for agencies first. Clastor is built for the
            solo tutor running a roster of students — online, in-person, or a
            bit of both.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* This — Clastor */}
          <article
            className="reveal rotate-audience doodle-card relative z-10 flex flex-col rounded-3xl border-brand bg-brand-soft p-8 shadow-[0_0_0_10px_hsl(var(--brand)/0.18),5px_5px_0_hsl(var(--foreground))] sm:p-9"
            style={{ ["--reveal-delay" as string]: "0ms" }}
          >
            <span className="absolute -top-4 left-8 -rotate-3 rounded-full border-[2.5px] border-foreground bg-brand px-3.5 py-1.5 font-display text-sm text-foreground shadow-sketch">
              Built for private tutors
            </span>
            <span className="eyebrow">Clastor</span>
            <h3 className="mb-5 mt-2.5 font-display text-[clamp(1.375rem,2.4vw,1.625rem)]">
              Built for the tutor. That's you.
            </h3>
            <ul className="flex flex-1 flex-col gap-3">
              {FOR_YOU.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-base text-foreground"
                >
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-[hsl(143_54%_28%)]"
                    strokeWidth={2.5}
                  />
                  {point}
                </li>
              ))}
            </ul>
          </article>

          {/* Not this — agency software */}
          <article
            className="reveal doodle-card doodle-dashed relative flex flex-col rounded-3xl bg-card p-8 opacity-80 sm:p-9"
            style={{ ["--reveal-delay" as string]: "100ms" }}
          >
            <span className="eyebrow">Tutoring-centre software</span>
            <h3 className="mb-5 mt-2.5 font-display text-[clamp(1.375rem,2.4vw,1.625rem)]">
              Built for the company, not the tutor.
            </h3>
            <ul className="flex flex-1 flex-col gap-3">
              {NOT_FOR.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-base text-muted-foreground"
                >
                  <X
                    className="mt-1 h-4 w-4 shrink-0 text-destructive"
                    strokeWidth={2.5}
                  />
                  <span className="line-through">{point}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
