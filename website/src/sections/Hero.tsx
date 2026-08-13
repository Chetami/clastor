import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Scribble, Sparkle } from "@/components/Doodles";
import { HeroIllustration } from "@/components/HeroIllustration";
import { APP_URL } from "@/lib/site";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-5 pt-28 pb-7 sm:px-6 sm:pt-36 lg:px-8"
    >
      {/* Hand-drawn sparkle accents around the headline + mockup. */}
      <Sparkle className="pointer-events-none absolute right-[7%] top-[16%] hidden h-9 w-9 rotate-12 text-brand/70 animate-float sm:block" />
      <Sparkle className="pointer-events-none absolute left-[6%] top-[58%] hidden h-7 w-7 -rotate-6 text-[hsl(48_92%_60%)] animate-float sm:block" />
      <div className="mx-auto grid max-w-[1040px] gap-10 text-center sm:gap-14">
        <div className="flex flex-col items-center">
          <h1 className="font-display text-[clamp(2.875rem,8vw,5.375rem)] leading-[1.12]">
            Teach more.
            <br />
            <span className="display-accent">Admin less.</span>
            <Scribble className="mx-auto -mt-1 block w-[min(420px,80%)] text-brand" />
          </h1>

          <p className="mt-6 max-w-[52ch] text-[clamp(1.0625rem,1.8vw,1.25rem)] leading-relaxed text-muted-foreground">
            Clastor is in early access, and we're building it with a small group
            of tutors. Join the beta, use it with your real students, and tell
            us what's broken — scheduling, reminders, invoicing, all of it.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <Button asChild variant="brand" size="xl">
              <a href={APP_URL}>Join the beta</a>
            </Button>
            <Button asChild variant="outline" size="xl">
              <a href="#how-it-works">
                See how it works
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" />
            Free during beta. No card needed — we just want your honest
            feedback.
          </p>
        </div>

        <div className="relative">
          <HeroMockup />
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}

/** Product mockup — a weekly schedule grid beside an invoice panel. */
function HeroMockup() {
  return (
    <div className="w-full">
      <div className="doodle-card overflow-hidden rounded-3xl shadow-sketch-lg">
        {/* Window bar */}
        <div className="flex items-center justify-between border-b-2 border-dashed border-border bg-secondary px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full border-[1.5px] border-foreground bg-destructive" />
              <span className="h-3 w-3 rounded-full border-[1.5px] border-foreground bg-[hsl(43_96%_56%)]" />
              <span className="h-3 w-3 rounded-full border-[1.5px] border-foreground bg-success" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Week of Mar 18
            </span>
          </div>
          <span className="text-sm text-muted-foreground">Maya R. · Tutor</span>
        </div>

        {/* Body: schedule + invoice */}
        <div className="grid md:grid-cols-[1fr_244px]">
          {/* Schedule */}
          <div className="border-b-2 border-dashed border-border p-5 md:border-b-0 md:border-r-2">
            <div className="mb-4 flex items-baseline justify-between">
              <h4 className="font-display text-2xl">This week</h4>
              <span className="font-mono text-xs tracking-[0.04em] text-muted-foreground">
                4 lessons · 2 invoices
              </span>
            </div>

            <div className="grid grid-cols-[46px_repeat(4,1fr)] border-t-2 border-border">
              <ColHead />
              <ColHead>Mon</ColHead>
              <ColHead>Wed</ColHead>
              <ColHead>Thu</ColHead>
              <ColHead>Fri</ColHead>

              <TimeCell>16:00</TimeCell>
              <Cell>
                <Lesson name="Liam · Physics" meta="60 min" />
              </Cell>
              <Cell />
              <Cell>
                <Lesson
                  name="Maya C. · Algebra"
                  meta="45 min · next"
                  highlight
                />
              </Cell>
              <Cell />

              <TimeCell>17:30</TimeCell>
              <Cell />
              <Cell>
                <Lesson name="Sara · Spanish" meta="60 min" />
              </Cell>
              <Cell />
              <Cell>
                <Lesson name="Noah · Chemistry" meta="45 min" />
              </Cell>
            </div>
          </div>

          {/* Invoice panel */}
          <aside className="flex flex-col bg-card p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h4 className="font-display text-lg">Invoice #1042</h4>
              <span className="doodle-pill border-success bg-[hsl(143_54%_89%)] text-[hsl(143_54%_28%)]">
                <Check className="h-2.5 w-2.5" />
                Paid
              </span>
            </div>

            <div className="mb-3.5 text-sm text-muted-foreground">
              <b className="block text-base text-foreground">Maya Chen</b>
              Algebra · Biweekly
            </div>

            <div className="flex flex-col gap-2.5 border-t-2 border-dashed border-border pt-3">
              <InvLine label="Lesson × 4" value="$180.00" />
              <InvLine label="Materials fee" value="$12.00" />
              <InvLine label="Processing" value="$0.00" />
            </div>

            <div className="mt-3.5 flex items-baseline justify-between border-t-2 border-border pt-3">
              <span className="font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
                Total
              </span>
              <b className="font-display text-4xl text-foreground">$192.00</b>
            </div>

            <div className="mt-auto flex items-center gap-1.5 pt-3.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              Paid Mar 20 · Auto-sent reminder
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ColHead({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-b-2 border-border px-1.5 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
      {children}
    </div>
  );
}

function TimeCell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-b-2 border-dashed border-border border-r-2 py-1.5 text-[10px] text-muted-foreground font-mono">
      {children}
    </div>
  );
}

function Cell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-[46px] border-b-2 border-dashed border-border border-r-2 p-1.5 last:border-r-0">
      {children}
    </div>
  );
}

function Lesson({
  name,
  meta,
  highlight = false,
}: {
  name: string;
  meta: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "my-0.5 rotate-[-1deg] rounded-[10px] border-[1.5px] border-foreground bg-brand px-2 py-1.5 text-[11.5px] leading-tight"
          : "my-0.5 rounded-[10px] border-[1.5px] border-border bg-secondary px-2 py-1.5 text-[11.5px] leading-tight text-muted-foreground"
      }
    >
      <b className="block text-[11.5px] text-foreground">{name}</b>
      <span className={highlight ? "text-foreground" : "text-muted-foreground"}>
        {meta}
      </span>
    </div>
  );
}

function InvLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <b className="text-foreground">{value}</b>
    </div>
  );
}
