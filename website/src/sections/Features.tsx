import {
  BarChart3,
  Bell,
  CalendarClock,
  CreditCard,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useReveal } from "@/hooks/useReveal";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function Features() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="scroll-mt-20 px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">Features</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            The whole back office, on one friendly page.
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            No more juggling a calendar tab, a spreadsheet, and a stack of
            paper invoices. Clastor keeps the loop connected.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-fr">
          {/* Scheduling — large hero feature */}
          <FeatureBig
            icon={CalendarClock}
            title="Scheduling that writes itself."
            description="Drop lessons onto the week, set a recurrence, and Clastor handles the rest — calendar sync, conflicts, and reminders sent automatically."
            index={0}
          >
            <MiniCalendar />
          </FeatureBig>

          <FeatureCard
            icon={CreditCard}
            title="Payments"
            description="Branded invoices, one-tap payment links, and automatic chase-ups. Get paid without the awkward follow-up."
            index={1}
          />
          <FeatureCard
            icon={Users}
            title="Students"
            description="One record per learner — history, notes, billing, and guardians together. Nothing slips through."
            index={2}
          />
          <FeatureCard
            icon={Bell}
            title="Communications"
            description="Reminders go out on schedule. Cancellations reshuffle automatically. Parents stay in the loop, gently."
            index={3}
          />
          <FeatureCard
            icon={BarChart3}
            title="Insights"
            description="See hours taught, revenue, and outstanding balances at a glance. Know your business without a spreadsheet."
            index={4}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: Feature & { index: number }) {
  return (
    <article
      className="reveal doodle-card flex min-h-[224px] flex-col rounded-3xl p-7 transition-transform duration-300 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-sketch-lg"
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <span className="mb-4 text-brand">
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </span>
      <h3 className="mb-2 font-display text-2xl">{title}</h3>
      <p className="text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </article>
  );
}

function FeatureBig({
  icon: Icon,
  title,
  description,
  index,
  children,
}: Feature & { index: number; children?: React.ReactNode }) {
  return (
    <article
      className="reveal doodle-card relative flex flex-col overflow-hidden rounded-3xl bg-secondary p-8 sm:col-span-2 lg:row-span-2"
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <span className="mb-4 text-brand">
        <Icon className="h-7 w-7" strokeWidth={2.2} />
      </span>
      <h3 className="mb-2.5 font-display text-[clamp(1.625rem,3vw,2rem)]">
        {title}
      </h3>
      <p className="max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-auto pt-6">{children}</div>
    </article>
  );
}

/** Hand-drawn mini-calendar visual with day dots + legend. */
function MiniCalendar() {
  const days = [
    { n: "", lbl: "M" }, { n: "", lbl: "T" }, { n: "", lbl: "W" },
    { n: "", lbl: "T" }, { n: "", lbl: "F" }, { n: "", lbl: "S" }, { n: "", lbl: "S" },
    { n: "" }, { n: "3", has: true }, { n: "" }, { n: "5", has: true, acc: true },
    { n: "" }, { n: "7", has: true }, { n: "" },
    { n: "" }, { n: "" }, { n: "10", has: true }, { n: "" }, { n: "" },
    { n: "12", has: true }, { n: "" },
    { n: "" }, { n: "17", has: true, acc: true }, { n: "" }, { n: "19", has: true },
    { n: "" }, { n: "" }, { n: "" },
  ];

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid max-w-[300px] grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className={
              "flex aspect-square items-center justify-center rounded-[10px] border-[1.5px] font-mono text-xs " +
              (d.lbl
                ? "border-transparent text-xs text-muted-foreground"
                : d.acc
                  ? "rotate-[-3deg] border-foreground bg-brand text-foreground"
                  : d.has
                    ? "border-foreground bg-card text-foreground"
                    : "border-border bg-card text-muted-foreground")
            }
          >
            {d.lbl || d.n}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 pb-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded border-[1.5px] border-foreground bg-card" />
          Lesson
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded border-[1.5px] border-foreground bg-brand" />
          Invoice sent
        </span>
      </div>
    </div>
  );
}
