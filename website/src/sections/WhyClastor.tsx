import { Check, TrendingUp } from "lucide-react";

import { SectionHeading } from "@/components/SectionHeading";
import { useReveal } from "@/hooks/useReveal";

const OUTCOMES: string[] = [
  "Spend less time on admin and more time teaching",
  "Never miss a lesson or a payment again",
  "Keep every student's information organized and in reach",
  "Look professional to parents and students",
  "Scale from a few students to a full tutoring business",
];

export function WhyClastor() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="why-clastor" className="scroll-mt-20 py-24 sm:py-28">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal">
            <SectionHeading
              align="left"
              eyebrow="Why Clastor"
              title="Built so you can get back to teaching"
              description="You became a tutor to teach — not to chase invoices and copy times between four apps. Clastor takes care of the business side so it stops eating your week."
            />

            <ul className="mt-8 space-y-4">
              {OUTCOMES.map((outcome, i) => (
                <li
                  key={outcome}
                  className="reveal flex items-start gap-3"
                  style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-base text-foreground">{outcome}</span>
                </li>
              ))}
            </ul>
          </div>

          <WhyClastorVisual />
        </div>
      </div>
    </section>
  );
}

/** A calm "business at a glance" panel — reinforces clarity without a mockup. */
function WhyClastorVisual() {
  return (
    <div
      className="reveal relative"
      style={{ ["--reveal-delay" as string]: "120ms" }}
    >
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-foreground/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              This month at a glance
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              $2,840
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
              <TrendingUp className="h-4 w-4" />
              +12% vs. last month
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <TrendingUp className="h-5 w-5" />
          </span>
        </div>

        {/* Simple bar visualization */}
        <div className="mt-6 flex items-end gap-2">
          {[40, 65, 50, 80, 70, 95, 60].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-brand/15"
              style={{ height: `${h}px` }}
            >
              <div
                className="h-full w-full rounded-t bg-brand"
                style={{ opacity: 0.3 + (i / 7) * 0.7 }}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
          <Stat label="Lessons taught" value="68" />
          <Stat label="Paid invoices" value="21" />
          <Stat label="Outstanding" value="$180" />
        </div>
      </div>

      {/* Soft floating reassurance chip */}
      <div className="animate-float absolute -bottom-5 -left-4 hidden rounded-xl border border-border bg-background px-4 py-3 shadow-lg sm:block">
        <p className="text-xs font-medium text-muted-foreground">
          Expected next month
        </p>
        <p className="text-lg font-semibold text-foreground">$3,120</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
