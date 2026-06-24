import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";
import { APP_URL } from "@/lib/site";

export function FinalCTA() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div ref={ref} className="mx-auto max-w-5xl">
        <div className="reveal relative overflow-hidden rounded-3xl border border-border bg-primary px-6 py-16 text-center sm:px-12">
          {/* Calm brand glow, kept subtle */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at top, hsl(var(--brand) / 0.55), transparent 65%)",
            }}
            aria-hidden="true"
          />
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden="true" />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-primary-foreground sm:text-4xl">
              Spend more time teaching and less time managing.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/70">
              Clastor handles the scheduling, reminders, and invoicing —
              connected, automatically. Start free today.
            </p>

            <div className="mt-8 flex justify-center">
              <Button asChild variant="brand" size="lg">
                <a href={APP_URL}>
                  Try Clastor Free
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-primary-foreground/60">
              No credit card required · Get started in minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
