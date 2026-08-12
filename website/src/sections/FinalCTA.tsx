import { useReveal } from "@/hooks/useReveal";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/site";

export function FinalCTA() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 pt-0 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-secondary px-6 py-16 text-center shadow-sketch-lg sm:px-12 sm:py-21">
          {/* Decorative doodle circles */}
          <span
            className="pointer-events-none absolute right-[6%] top-6 h-[70px] w-[70px] rounded-full border-[2.5px] border-foreground bg-brand opacity-85"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute bottom-6 left-[7%] h-[46px] w-[46px] rounded-full border-[2.5px] border-foreground bg-[hsl(143_54%_89%)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-[clamp(2rem,5.2vw,3.5rem)] leading-[1.1]">
              Teach more. <span className="display-accent">Admin less.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
              Start free for your first 10 students. Set up in an afternoon,
              send your first branded invoice today.
            </p>

            <div className="mt-7">
              <Button asChild variant="brand" size="xl">
                <a href={APP_URL}>Start free</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No card required · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
