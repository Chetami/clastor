import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";

export function FinalCTA() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div ref={ref} className="mx-auto max-w-5xl">
        <div className="reveal relative overflow-hidden rounded-3xl bg-primary px-6 py-20 text-center sm:px-12">
          {/* Dramatic emerald glow on dark */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse at top, hsl(var(--brand) / 0.5), transparent 60%)",
            }}
            aria-hidden="true"
          />
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden="true" />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance font-display text-4xl leading-[1.08] tracking-tighter text-background sm:text-5xl md:text-6xl">
              Spend more time teaching,{" "}
              <span className="font-display italic text-brand-soft">
                less time managing.
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-background/70">
              Clastor handles the scheduling, reminders, and invoicing —
              connected, automatically. Start free today.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="xl">
                <a href={APP_URL}>
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="xl"
                className="border border-background/20 bg-background/5 text-background hover:bg-background/10"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-background/50">
              No credit card required · Get started in minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
