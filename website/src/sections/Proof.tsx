import { Sparkle, Star } from "@/components/Doodles";
import { useReveal } from "@/hooks/useReveal";

/*
 * Beta credibility.
 *
 * The numbers in `STATS` below are PLACEHOLDERS. Before this page goes live,
 * replace each value with a real figure from the beta cohort. Do not ship
 * fabricated metrics — honesty is the whole point of this section
 * (see MARKETING.md §12.4). If you don't have real numbers yet, swap a stat
 * for an honest qualitative signal (e.g. "co-built with tutors in early
 * access") rather than inventing one.
 */
interface Stat {
  value: string;
  label: string;
  caption: string;
  rotate: string;
}

const STATS: Stat[] = [
  {
    value: "12",
    label: "private tutors in early access",
    caption: "Running their real rosters on Clastor — not a demo.",
    rotate: "rotate-tiny-neg",
  },
  {
    value: "480+",
    label: "lessons scheduled",
    caption: "Maths, science, languages, music, and test prep.",
    rotate: "",
  },
  {
    value: "$24k+",
    label: "invoiced through Clastor",
    caption: "Branded invoices, online payments, zero spreadsheets.",
    rotate: "rotate-tiny-pos",
  },
];

/**
 * Proof section — replaces fabricated testimonials with honest, concrete
 * signals about where Clastor actually stands. Keeps the doodle card +
 * reveal treatment so it reads as part of the same system.
 */
export function Proof() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="relative scroll-mt-20 overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
      {/* Hand-drawn accents scattered in the margins. */}
      <Star className="pointer-events-none absolute right-[6%] top-[10%] hidden h-8 w-8 rotate-12 text-brand/45 animate-float sm:block" />
      <Sparkle className="pointer-events-none absolute left-[5%] top-[60%] hidden h-7 w-7 -rotate-6 text-warm sm:block" />

      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[680px] sm:mb-14">
          <p className="eyebrow">Early access</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Built with tutors, not in a vacuum.
          </h2>
          <p className="mt-3.5 max-w-[56ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            No fabricated testimonials, no inflated numbers. Clastor is in beta
            with real private tutors running real lessons. Here's where things
            actually stand.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {STATS.map((s, i) => (
            <article
              key={s.label}
              className={`reveal doodle-card relative flex flex-col gap-2 rounded-3xl p-7 ${s.rotate}`}
              style={{ ["--reveal-delay" as string]: `${i * 100}ms` }}
            >
              <b className="font-display text-[clamp(2.75rem,6vw,4rem)] leading-none text-brand">
                {s.value}
              </b>
              <span className="font-display text-lg leading-tight">
                {s.label}
              </span>
              <p className="text-base leading-relaxed text-muted-foreground">
                {s.caption}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
