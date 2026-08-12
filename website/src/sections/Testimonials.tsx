import { Coffee, FileCheck2, CalendarHeart } from "lucide-react";

import type { LucideIcon } from "lucide-react";

import { Asterisk, Star } from "@/components/Doodles";
import { useReveal } from "@/hooks/useReveal";

/**
 * Outcomes section.
 *
 * Replaces fabricated testimonials. Real, attributed testimonials from early
 * users should be added here once available (see MARKETING.md §12.4). Until
 * then we reinforce concrete outcomes the product delivers — without
 * impersonating real people.
 */
interface Outcome {
  icon: LucideIcon;
  title: string;
  description: string;
  rotate: string;
  warm?: boolean;
}

const OUTCOMES: Outcome[] = [
  {
    icon: Coffee,
    title: "Your evenings back",
    description:
      "Reminders, calendar invites, and invoice emails go out on their own. The hour you used to spend on admin turns into time off, or just one more lesson.",
    rotate: "rotate-tiny-neg",
  },
  {
    icon: FileCheck2,
    title: "A business that looks the part",
    description:
      "Branded invoices, polished emails, and a public profile make a solo operation feel established to every student and parent.",
    rotate: "",
    warm: true,
  },
  {
    icon: CalendarHeart,
    title: "One source of truth",
    description:
      "Schedule, students, and billing all in one place, so you always know who's paid, what's next, and how the month is really going.",
    rotate: "rotate-tiny-pos",
  },
];

export function Testimonials() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="relative scroll-mt-20 overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
      {/* Hand-drawn accents scattered in the margins. */}
      <Star className="pointer-events-none absolute right-[6%] top-[10%] hidden h-8 w-8 rotate-12 text-brand/45 animate-float sm:block" />
      <Asterisk className="pointer-events-none absolute left-[5%] top-[58%] hidden h-7 w-7 rotate-6 text-[hsl(168_60%_55%)]/50 sm:block" />
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">What changes</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Less spreadsheets. More teaching.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {OUTCOMES.map((o, i) => (
            <OutcomeCard key={o.title} outcome={o} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OutcomeCard({ outcome, index }: { outcome: Outcome; index: number }) {
  const Icon = outcome.icon;
  return (
    <article
      className={`reveal doodle-card relative flex flex-col gap-4 rounded-3xl p-7 ${outcome.rotate} ${
        outcome.warm ? "bg-secondary" : ""
      }`}
      style={{ ["--reveal-delay" as string]: `${index * 100}ms` }}
    >
      <span className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-foreground bg-brand text-foreground shadow-sketch">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <h3 className="font-display text-2xl">{outcome.title}</h3>
      <p className="text-base leading-relaxed text-muted-foreground">
        {outcome.description}
      </p>
    </article>
  );
}
