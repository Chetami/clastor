import { Star } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  rotate: string;
  warm?: boolean;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to spend Sunday nights rebuilding invoices in a spreadsheet. Now a lesson ends and the invoice is already on its way. My weekends are mine again.",
    name: "Priya R.",
    role: "Maths tutor · 22 students",
    initials: "PR",
    rotate: "rotate-tiny-neg",
  },
  {
    quote:
      "Parents compliment the invoices now. It looks like a real business, not a side gig. That alone made it worth switching.",
    name: "James M.",
    role: "Physics & chemistry · 14 students",
    initials: "JM",
    rotate: "",
    warm: true,
  },
  {
    quote:
      "My partner and I share the calendar without stepping on each other. The reminders mean no one forgets a lesson anymore.",
    name: "Sofia K.",
    role: "Language tutor · team of 2",
    initials: "SK",
    rotate: "rotate-tiny-pos",
  },
];

export function Testimonials() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="scroll-mt-20 px-5 pt-0 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">From working tutors</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Less spreadsheets. More teaching.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <QuoteCard key={i} testimonial={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index: number;
}) {
  return (
    <figure
      className={`reveal doodle-card flex flex-col gap-4 rounded-3xl p-7 ${testimonial.rotate} ${
        testimonial.warm ? "bg-secondary" : ""
      }`}
      style={{ ["--reveal-delay" as string]: `${index * 100}ms` }}
    >
      <div className="flex gap-0.5 text-brand" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-brand" aria-hidden="true" />
        ))}
      </div>

      <blockquote className="flex-1 text-lg leading-relaxed text-foreground">
        <span className="text-brand">&ldquo;</span>
        {testimonial.quote}
      </blockquote>

      <figcaption className="flex items-center gap-3 border-t-2 border-dashed border-border pt-1.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-foreground bg-brand font-display text-base text-foreground">
          {testimonial.initials}
        </span>
        <span>
          <b className="block text-base text-foreground">{testimonial.name}</b>
          <span className="text-sm text-muted-foreground">{testimonial.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}
