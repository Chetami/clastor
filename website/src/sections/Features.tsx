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
    <section id="features" className="scroll-mt-20 py-24 sm:py-32">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        {/* Editorial heading — left aligned, asymmetric */}
        <div className="reveal max-w-2xl">
          <p className="eyebrow">Features</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-[1.1] tracking-tighter text-foreground sm:text-5xl">
            One connected system,{" "}
            <span className="display-accent">not a patchwork.</span>
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Schedule a lesson and it's on the calendar, the student is
            reminded, and the hours flow straight into an invoice. Each part
            works with the others — so the busywork happens automatically.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mt-14 grid gap-5 md:grid-cols-12">
          {/* Scheduling — large hero feature */}
          <FeatureLarge
            icon={CalendarClock}
            title="Scheduling that runs itself"
            description="A drag-and-drop calendar for one-off or recurring lessons. Two-way Google Calendar sync, auto-generated Meet links, working-hour guardrails — booking takes seconds."
            className="md:col-span-8"
            index={0}
          >
            <MiniCalendar />
          </FeatureLarge>

          {/* Payments — tall stat card */}
          <FeatureStat
            icon={CreditCard}
            title="Get paid without the chase"
            description="Turn unpaid lessons into a polished, itemized invoice in one click. Stripe checkout means money lands in your account — no spreadsheet archaeology."
            stat="$2,840"
            statLabel="collected this month"
            className="md:col-span-4"
            index={1}
          />

          {/* Students */}
          <FeatureCard
            icon={Users}
            title="Students, all in one place"
            description="Contact details, subjects, rates, notes, and linked parents. Always know who owes what, with per-student timezones for online tutors."
            className="md:col-span-4"
            index={2}
          />
          {/* Communications */}
          <FeatureCard
            icon={Bell}
            title="Comms students actually read"
            description={`Automatic calendar invites, reminders on a schedule, and one-tap RSVP. Fewer "are we still on?" messages, fewer no-shows.`}
            className="md:col-span-4"
            index={3}
          />
          {/* Insights */}
          <FeatureCard
            icon={BarChart3}
            title="Know your business"
            description="A dashboard showing expected vs. actual income, hours taught, and what needs attention. Plan instead of guess."
            className="md:col-span-4"
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
  className = "",
  index,
}: Feature & { className?: string; index: number }) {
  return (
    <div
      className={`reveal group flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-foreground/5 ${className}`}
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-brand-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-display text-xl tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function FeatureLarge({
  icon: Icon,
  title,
  description,
  className = "",
  index,
  children,
}: Feature & { className?: string; index: number; children?: React.ReactNode }) {
  return (
    <div
      className={`reveal group flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:border-brand/30 hover:shadow-xl hover:shadow-foreground/5 ${className}`}
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
        <div className="flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-brand-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 font-display text-2xl tracking-tight text-foreground">
            {title}
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="mt-6 sm:mt-0 sm:w-64">{children}</div>
      </div>
    </div>
  );
}

function FeatureStat({
  icon: Icon,
  title,
  description,
  stat,
  statLabel,
  className = "",
  index,
}: Feature & {
  stat: string;
  statLabel: string;
  className?: string;
  index: number;
}) {
  return (
    <div
      className={`reveal group flex h-full flex-col rounded-2xl border border-border bg-gradient-to-br from-brand to-brand-hover p-7 text-brand-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand/20 ${className}`}
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-display text-2xl tracking-tight">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-brand-foreground/80">
        {description}
      </p>
      <div className="mt-auto pt-6">
        <p className="font-display text-4xl tracking-tighter">{stat}</p>
        <p className="mt-1 text-xs text-brand-foreground/70">{statLabel}</p>
      </div>
    </div>
  );
}

function MiniCalendar() {
  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          This week
        </span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
          18 lessons
        </span>
      </div>
      <div className="space-y-1.5">
        {[
          { d: "Mon", t: "4:00 PM", s: "Maths · Aisha K.", on: true },
          { d: "Tue", t: "6:30 PM", s: "Physics · Liam R.", on: false },
          { d: "Wed", t: "5:00 PM", s: "11+ Prep · Sara M.", on: false },
          { d: "Thu", t: "4:00 PM", s: "Methods · Aisha K.", on: false },
        ].map((r) => (
          <div
            key={r.d}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
          >
            <span
              className={
                r.on
                  ? "h-6 w-0.5 rounded-full bg-brand"
                  : "h-6 w-0.5 rounded-full bg-foreground/15"
              }
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-foreground">
                {r.s}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {r.d} · {r.t}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
