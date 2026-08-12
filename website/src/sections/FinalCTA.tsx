import { useReveal } from "@/hooks/useReveal";
import { Button } from "@/components/ui/button";
import { Scribble } from "@/components/Doodles";
import { APP_URL } from "@/lib/site";

export function FinalCTA() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal relative overflow-hidden rounded-3xl border-[3px] border-foreground bg-secondary px-6 py-16 text-center shadow-sketch-lg sm:px-12 sm:py-20">
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
              Get your{" "}
              <span className="display-accent relative inline-block">
                evenings
                <Scribble className="absolute -bottom-2 left-0 h-2.5 w-full text-brand" />
              </span>{" "}
              back.
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
              Set up in an afternoon and send your first branded invoice today.
              The reminders, calendar sync, and chasing happen on their own from
              here on out.
            </p>

            <div className="mt-7">
              <Button asChild variant="brand" size="xl">
                <a href={APP_URL}>Request beta access</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Limited spots · No card needed
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
