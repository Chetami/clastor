import { Star } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  accent: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to spend my Sunday evenings hand-writing invoices in a Google Doc. Now it's one click at the end of the month. That alone gave me my weekends back.",
    name: "Representative tutor",
    role: "GCSE & A-level Maths · 22 students",
    initials: "RT",
    accent: "bg-brand text-brand-foreground",
  },
  {
    quote:
      "The reminders are the quiet hero. My no-show rate dropped because students actually get the calendar invite and a nudge beforehand.",
    name: "Representative tutor",
    role: "Online Physics · international students",
    initials: "RT",
    accent: "bg-foreground text-background",
  },
  {
    quote:
      "For the first time I know my real monthly income without opening a spreadsheet. Expected vs. actual — right there on the dashboard.",
    name: "Representative tutor",
    role: "11+ & entrance prep · mixed online & in-person",
    initials: "RT",
    accent: "bg-warm text-white",
  },
];

export function Testimonials() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="scroll-mt-20 py-24 sm:py-32">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="eyebrow">Early feedback</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-[1.1] tracking-tighter text-foreground sm:text-5xl">
            What tutors tell us they love.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Built alongside real tutors solving real admin pain. Here's what
            stands out.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} index={i} />
          ))}
        </div>

        <p className="reveal mt-8 text-center text-sm text-muted-foreground">
          We're in active development with early tutors. Want to shape what we
          build next?{" "}
          <a href="#top" className="font-semibold text-brand hover:underline">
            Join the early access cohort
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index: number;
}) {
  return (
    <figure
      className="reveal flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-foreground/5"
      style={{ ["--reveal-delay" as string]: `${index * 100}ms` }}
    >
      {/* Custom star rating — brand-coloured, not default yellow */}
      <div className="flex gap-0.5" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-4 w-4 fill-brand text-brand"
            aria-hidden="true"
          />
        ))}
      </div>

      <blockquote className="mt-5 flex-1">
        <p className="text-pretty font-display text-lg italic leading-relaxed text-foreground">
          "{testimonial.quote}"
        </p>
      </blockquote>

      <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${testimonial.accent}`}
        >
          {testimonial.initials}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {testimonial.name}
          </p>
          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
