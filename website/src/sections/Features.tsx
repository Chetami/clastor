import { Check, Repeat } from "lucide-react";

import { Sparkle } from "@/components/Doodles";
import { useReveal } from "@/hooks/useReveal";

interface Feature {
  title: string;
  description: string;
}

export function Features() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="features"
      className="relative scroll-mt-20 overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:px-8"
    >
      {/* Hand-drawn sparkle accents scattered in the margins. */}
      <Sparkle className="pointer-events-none absolute right-[5%] top-[7%] hidden h-8 w-8 rotate-12 text-brand/25 sm:block" />
      <Sparkle className="pointer-events-none absolute left-[4%] bottom-[9%] hidden h-6 w-6 -rotate-6 text-[hsl(48_92%_60%)]/40 sm:block" />

      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">Features</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.875rem,4.6vw,3.125rem)] leading-[1.12]">
            Your tutoring business, all in one place.
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            Schedule, students, and invoices — together. No more juggling tabs
            and spreadsheets.
          </p>
        </div>

        {/* Bento grid — an asymmetric layout that avoids a cookie-cutter
            feature wall. Scheduling anchors the top-left with Insights
            stacked directly beneath it; Payments & Students sit beside
            Scheduling, and Comms spans wide beside Insights. Every card
            sizes to its content so nothing stretches or leaves gaps. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Scheduling — large hero feature */}
          <FeatureBig
            title="Scheduling that writes itself."
            description="Drop lessons onto the week, set a recurrence, and Clastor handles the rest — calendar sync, conflicts, and reminders sent automatically."
            index={0}
          >
            <MiniCalendar />
          </FeatureBig>

          {/* Payments */}
          <FeatureCard
            title="Payments"
            description="Branded invoices and one-tap payment links. No more chasing parents for unpaid lessons."
            index={1}
          >
            <MiniInvoice />
          </FeatureCard>

          {/* Students */}
          <FeatureCard
            title="Students"
            description="One record per learner — history, notes, and billing together. Nothing slips through."
            index={2}
          >
            <MiniRoster />
          </FeatureCard>

          {/* Insights — beneath Scheduling */}
          <FeatureCard
            title="Insights"
            description="See hours taught, revenue, and outstanding balances at a glance. Know your business without a spreadsheet."
            index={3}
            className="sm:col-span-2 lg:col-span-2"
          >
            <MiniChart />
          </FeatureCard>

          {/* Communications — wide, text beside visual */}
          <FeatureCard
            title="Communications"
            description="Reminders go out on schedule. Cancellations reshuffle automatically. Parents stay in the loop, gently."
            index={4}
            className="sm:col-span-2 lg:col-span-2"
            side
          >
            <MiniMessages />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  description,
  index,
  className = "",
  children,
  side = false,
  wide = false,
}: Feature & {
  index: number;
  className?: string;
  children?: React.ReactNode;
  side?: boolean;
  wide?: boolean;
}) {
  return (
    <article
      className={`reveal doodle-card flex min-h-[200px] flex-col rounded-3xl ${
        side ? "lg:flex-row lg:items-center lg:gap-10" : ""
      } ${wide ? "p-7 lg:p-6" : side ? "p-6" : "p-7"} ${className}`}
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
      <div className={side ? "lg:flex-1" : ""}>
        <h3
          className={`mb-2 font-display ${
            wide ? "text-[clamp(1.5rem,2.6vw,2rem)]" : "text-2xl"
          }`}
        >
          {title}
        </h3>
        <p
          className={`max-w-[44ch] text-base text-muted-foreground ${
            side ? "leading-normal" : "leading-relaxed"
          }`}
        >
          {description}
        </p>
      </div>
      {children && (
        <div
          className={`mt-auto pt-6 ${
            side ? "lg:mt-0 lg:shrink-0 lg:pt-0" : ""
          }`}
        >
          {children}
        </div>
      )}
    </article>
  );
}

function FeatureBig({
  title,
  description,
  index,
  children,
}: Feature & { index: number; children?: React.ReactNode }) {
  return (
    <article
      className="reveal doodle-card relative flex flex-col overflow-hidden rounded-3xl bg-secondary p-8 sm:col-span-2"
      style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
    >
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

/** Weekly schedule visual — lessons as time-blocks with recurrence + auto-reschedule. */
function MiniCalendar() {
  const week: {
    day: string;
    date: string;
    subj: string;
    student: string;
    time: string;
    next?: boolean;
    moved?: boolean;
  }[] = [
    { day: "Mon", date: "13", subj: "Physics", student: "Liam C.", time: "4:00" },
    { day: "Tue", date: "14", subj: "English", student: "Sara R.", time: "5:00" },
    { day: "Wed", date: "15", subj: "Maths", student: "Noah S.", time: "5:30", next: true },
    { day: "Thu", date: "16", subj: "Physics", student: "Liam C.", time: "4:00" },
    { day: "Fri", date: "17", subj: "Chem", student: "Maya K.", time: "3:30", moved: true },
  ];

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          This week
        </span>
        <span className="inline-flex items-center gap-1 border-[1.5px] border-foreground bg-card px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-foreground">
          <Repeat className="h-2.5 w-2.5" strokeWidth={2.5} /> Weekly
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {week.map((d) => (
          <div
            key={d.day}
            className={
              "flex min-w-0 flex-col rounded-lg border-[1.5px] px-2 py-1.5 " +
              (d.next
                ? "-rotate-2 border-foreground bg-brand text-foreground shadow-sketch"
                : d.moved
                  ? "border-dashed border-foreground bg-card text-foreground"
                  : "border-foreground bg-card text-foreground")
            }
          >
            {/* Compact date strip — calendar context, not the focus. */}
            <div className="flex items-baseline justify-center gap-1 border-b-[1.5px] border-foreground/15 pb-1">
              <b className="font-mono text-[11px] font-semibold leading-none">
                {d.date}
              </b>
              <span className="font-mono text-[8px] uppercase tracking-wide opacity-60">
                {d.day}
              </span>
            </div>
            {/* Lesson detail — time leads (scannable), subject + student follow. */}
            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-center">
              <b className="font-mono text-[13px] font-bold leading-none tracking-tight">
                {d.time}
                <span className="ml-0.5 text-[9px] font-semibold opacity-60">pm</span>
              </b>
              <span className="block w-full truncate text-[11px] font-semibold leading-tight">
                {d.subj}
              </span>
              <span className="block w-full truncate text-[9px] leading-tight opacity-70">
                {d.student}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 border-[1.5px] border-foreground bg-brand" />
          Next
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 border-[1.5px] border-dashed border-foreground bg-card" />
          Rescheduled
        </span>
      </div>
    </div>
  );
}

/** Mini invoice snippet with a rotated "Paid" stamp. */
function MiniInvoice() {
  return (
    <div className="w-full max-w-[210px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
          Inv #1042
        </span>
        <span className="inline-flex -rotate-3 items-center gap-1 rounded-full border-[2px] border-success bg-[hsl(143_54%_89%)] px-2 py-0.5 font-mono text-[9px] font-medium uppercase text-[hsl(143_54%_28%)]">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
          Paid
        </span>
      </div>
      <div className="space-y-1.5 border-t-2 border-dashed border-border pt-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Lessons × 4</span>
          <b className="text-foreground">$180</b>
        </div>
        <div className="flex justify-between">
          <span>Materials</span>
          <b className="text-foreground">$12</b>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-border pt-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Total
        </span>
        <b className="font-display text-2xl text-foreground">$192</b>
      </div>
    </div>
  );
}

/** Overlapping student avatars with an overflow count. */
function MiniRoster() {
  const students: { initials: string; tone: string }[] = [
    { initials: "LC", tone: "bg-brand" },
    { initials: "SR", tone: "bg-[hsl(48_92%_70%)]" },
    { initials: "NS", tone: "bg-[hsl(168_60%_72%)]" },
    { initials: "MK", tone: "bg-[hsl(280_60%_82%)]" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex -space-x-2.5">
        {students.map((s) => (
          <span
            key={s.initials}
            className={`flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-foreground ${s.tone} font-mono text-[12px] font-medium text-foreground`}
          >
            {s.initials}
          </span>
        ))}
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-foreground bg-card font-mono text-[10px] font-medium text-muted-foreground">
          +6
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        10 active · 3 this week
      </span>
    </div>
  );
}

/** Auto-reminder chat bubbles — outgoing + parent reply. */
function MiniMessages() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2">
      <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md border-[1.5px] border-foreground bg-secondary px-3 py-2 text-xs font-semibold text-foreground">
        <b className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-foreground">
          Reminder · auto
        </b>
        Liam's Physics lesson — tomorrow 4pm
      </div>
      <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md border-[1.5px] border-dashed border-foreground bg-secondary px-3 py-2 text-xs font-semibold text-foreground">
        <b className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-foreground">
          Rescheduled · auto
        </b>
        Noah's Maths moved to Fri 3:30pm
      </div>
      <div className="max-w-[80%] self-end rounded-2xl rounded-br-md border-[1.5px] border-foreground bg-brand px-3 py-2 text-xs font-bold text-foreground">
        Thanks! We'll be there.
      </div>
      <span className="flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
        <Check className="h-3 w-3 text-success" strokeWidth={2.5} />
        Sent · 2 notices this week
      </span>
    </div>
  );
}

/** Weekly hours bar chart with headline stats. */
function MiniChart() {
  const bars: { day: string; h: number; acc?: boolean }[] = [
    { day: "Mon", h: 40 },
    { day: "Tue", h: 65 },
    { day: "Wed", h: 30 },
    { day: "Thu", h: 85, acc: true },
    { day: "Fri", h: 55 },
    { day: "Sat", h: 20 },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        {bars.map((b) => (
          <div
            key={b.day}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex h-20 w-full items-end">
              <div
                className={`w-full rounded-t-md border-[1.5px] border-foreground ${
                  b.acc ? "bg-brand" : "bg-secondary"
                }`}
                style={{ height: `${b.h}%` }}
              />
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              {b.day}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-5 border-t-2 border-dashed border-border pt-2.5">
        <span className="flex items-baseline gap-1">
          <b className="font-display text-xl text-foreground">12.5</b>
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            hrs
          </span>
        </span>
        <span className="flex items-baseline gap-1">
          <b className="font-display text-xl text-foreground">$840</b>
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            this week
          </span>
        </span>
      </div>
    </div>
  );
}
