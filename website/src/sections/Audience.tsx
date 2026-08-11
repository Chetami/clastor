import { ArrowRight, Check, Building2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";

const SOLO_POINTS = [
  "Everything one tutor needs — no bloat",
  "From your first student to a full schedule",
  "Look professional with branded invoices & profile",
];

const TEAM_POINTS = [
  "Individual logins with a shared student view",
  "Shared branding across every tutor",
  "One source of truth for the whole team",
];

export function Audience() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="for-teams" className="scroll-mt-20 py-24 sm:py-32">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="eyebrow">For tutors & teams</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-[1.1] tracking-tighter text-foreground sm:text-5xl">
            Built for the individual.{" "}
            <span className="display-accent">Scales to a team.</span>
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Most tutoring software is built for big agencies. Clastor starts
            with what a solo tutor actually needs — then grows with you.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* Solo tutors — primary */}
          <div
            className="reveal relative overflow-hidden rounded-2xl border-2 border-brand bg-gradient-to-br from-brand-soft to-card p-8"
            style={{ ["--reveal-delay" as string]: "0ms" }}
          >
            <span className="absolute right-6 top-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
              Most popular
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <User className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-2xl tracking-tight text-foreground">
              For independent tutors
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              Run your tutoring business from one calm place. Schedule,
              invoice, and get paid — without juggling four apps.
            </p>
            <ul className="mt-6 space-y-3">
              {SOLO_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm text-foreground">{point}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="brand" className="mt-7 w-full sm:w-auto">
              <a href={APP_URL}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Teams — secondary */}
          <div
            className="reveal rounded-2xl border border-border bg-card p-8"
            style={{ ["--reveal-delay" as string]: "100ms" }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Building2 className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-2xl tracking-tight text-foreground">
              For small tutoring teams
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              Two to five tutors sharing students or branding? Clastor gives
              everyone individual logins and a shared view — without the
              enterprise price tag.
            </p>
            <ul className="mt-6 space-y-3">
              {TEAM_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm text-foreground">{point}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-7 w-full sm:w-auto">
              <a href={APP_URL}>
                Explore team setup
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
