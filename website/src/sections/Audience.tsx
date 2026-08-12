import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sparkle, Star } from "@/components/Doodles";
import { SoloTutorIllustration } from "@/components/SoloTutorIllustration";
import { TeamTutorIllustration } from "@/components/TeamTutorIllustration";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";

const SOLO_POINTS = [
  "Unlimited lessons, reminders & calendar sync",
  "Branded invoices with your name & logo",
  "Public booking profile for new students",
  "Stripe payments, no awkward chasing",
];

const TEAM_POINTS = [
  "Shared calendar with per-tutor filters",
  "Split or pooled invoicing for partners",
  "One student record across tutors",
  "Role-based access for assistants",
];

export function Audience() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="for-teams" className="relative scroll-mt-20 overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
      {/* Hand-drawn accents scattered in the margins. */}
      <Star className="pointer-events-none absolute right-[6%] top-[13%] hidden h-7 w-7 rotate-6 text-[hsl(280_60%_60%)]/45 sm:block" />
      <Sparkle className="pointer-events-none absolute left-[4%] bottom-[12%] hidden h-7 w-7 -rotate-12 text-[hsl(48_92%_60%)]/55 sm:block" />
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">For tutors &amp; teams</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Built for one. Grows into a few.
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            Clastor starts with the solo tutor in mind. When you bring on a
            colleague, the team layer is already there.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* Solo tutors — primary */}
          <article
            className="reveal rotate-audience doodle-card relative flex flex-col rounded-3xl bg-secondary p-8 shadow-sketch-lg sm:p-9"
            style={{ ["--reveal-delay" as string]: "0ms" }}
          >
            <span className="absolute -top-4 left-8 -rotate-3 rounded-full border-[2.5px] border-foreground bg-brand px-3.5 py-1.5 font-display text-sm text-foreground shadow-sketch">
              Most popular
            </span>
            {/* happy_tutor mascot, clipped to the card's rounded bounds.
                Position it precisely in SoloTutorIllustration.tsx
                (POSITION config). Heading below keeps right-padding so text
                wraps clear of it. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <SoloTutorIllustration />
            </div>
            <span className="eyebrow">Independent tutors</span>
            <h3 className="mb-1 mt-2.5 pr-28 font-display text-[clamp(1.375rem,2.4vw,1.625rem)] sm:pr-36 lg:pr-44">
              Run your tutoring like a business.
            </h3>
            <p className="mb-5 text-base text-muted-foreground">
              For 5–40 students · Beta open
            </p>
            <ul className="mb-6 flex flex-1 flex-col gap-3">
              {SOLO_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-base text-foreground">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[hsl(143_54%_28%)]" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
            <Button asChild variant="brand" className="self-start">
              <a href={APP_URL}>Try the beta</a>
            </Button>
          </article>

          {/* Teams — secondary */}
          <article
            className="reveal doodle-card relative flex flex-col rounded-3xl p-8 sm:p-9"
            style={{ ["--reveal-delay" as string]: "100ms" }}
          >
            {/* group_tutors mascot, clipped to the card's rounded bounds.
                Position it precisely in TeamTutorIllustration.tsx
                (POSITION config). Heading below keeps right-padding so text
                wraps clear of it. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <TeamTutorIllustration />
            </div>
            <span className="eyebrow">Small tutoring teams</span>
            <h3 className="mb-1 mt-2.5 pr-28 font-display text-[clamp(1.375rem,2.4vw,1.625rem)] sm:pr-36 lg:pr-44">
              Bring on a colleague, cleanly.
            </h3>
            <p className="mb-5 text-base text-muted-foreground">
              Shared schedule · Per-tutor view
            </p>
            <ul className="mb-6 flex flex-1 flex-col gap-3">
              {TEAM_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-base text-foreground">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[hsl(143_54%_28%)]" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href="mailto:info@xamify.com.au"
              className="link-arrow inline-flex items-center gap-1.5 self-start border-b-2 border-[hsl(25_100%_80%)] pb-0.5 text-lg text-brand transition-colors hover:border-brand"
            >
              Talk to us about teams
              <ArrowRight className="h-4 w-4" />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
