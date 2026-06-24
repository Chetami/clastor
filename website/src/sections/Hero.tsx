import { ArrowRight, CalendarDays, Check, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/site";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      {/* Calm depth: faint grid + soft brand glow, low-key, not a giant gradient. */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[680px] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--brand)), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-in brand-chip">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            The business of tutoring, handled
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground sm:text-5xl md:text-6xl">
            Run your tutoring business without the admin headache.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Manage students, lessons, scheduling, invoices, and payments in one
            calm, organized workspace — so you can spend more time teaching.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
              <a href={APP_URL}>
                Try Clastor Free
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · Works with your Google Calendar
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A stylized, abstract product preview built from UI primitives — no mockups. */
function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl animate-scale-in">
      <div className="rounded-2xl border border-border bg-card p-2 shadow-xl shadow-foreground/5 ring-1 ring-border/40">
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {/* Window bar */}
          <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <div className="ml-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Your week · automatically organized
            </div>
          </div>

          {/* Body */}
          <div className="grid gap-4 p-5 sm:grid-cols-5">
            {/* Schedule */}
            <div className="sm:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  This week
                </p>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  18 lessons
                </span>
              </div>
              <div className="space-y-2">
                <ScheduleRow
                  time="Mon · 4:00 PM"
                  title="Specialist Maths · Aisha K."
                  tone="brand"
                />
                <ScheduleRow time="Tue · 6:30 PM" title="Physics · Liam R." />
                <ScheduleRow time="Wed · 5:00 PM" title="11+ Prep · Sara M." />
                <ScheduleRow time="Thu · 4:00 PM" title="Mathematical Methods · Aisha K." />
              </div>
            </div>

            {/* Side: invoice + payment */}
            <div className="space-y-3 sm:col-span-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Invoice #1042
                </div>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  $320.00
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
                  <Check className="h-3.5 w-3.5" />
                  Sent · awaiting payment
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Payment received
                    </p>
                    <p className="text-xs text-muted-foreground">
                      $280.00 · Liam R.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Reminder sent
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  Thursday 4:00 PM · confirmed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent chip — subtle, respects reduced motion via CSS */}
      <div className="animate-float absolute -right-3 -top-4 hidden rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg sm:block">
        <span className="flex items-center gap-1.5 text-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Everything connected
        </span>
      </div>
    </div>
  );
}

function ScheduleRow({
  time,
  title,
  tone = "default",
}: {
  time: string;
  title: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
      <span
        className={
          tone === "brand"
            ? "h-8 w-1 rounded-full bg-brand"
            : "h-8 w-1 rounded-full bg-foreground/15"
        }
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}
