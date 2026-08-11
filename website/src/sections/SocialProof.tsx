import { useReveal } from "@/hooks/useReveal";

const STATS = [
  { value: "4", suffix: "hrs", label: "Saved every week on admin" },
  { value: "1", suffix: "click", label: "From lesson to invoice" },
  { value: "0", suffix: "", label: "Missed reminders, ever" },
];

const INTEGRATIONS = ["Google Calendar", "Google Meet", "Stripe", "Gmail"];

export function SocialProof() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="bg-paper relative border-y border-border/60 py-16 sm:py-20">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        {/* Stats row */}
        <div className="grid gap-8 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="reveal text-center sm:text-left"
              style={{ ["--reveal-delay" as string]: `${i * 100}ms` }}
            >
              <div className="flex items-baseline justify-center gap-1 sm:justify-start">
                <span className="font-display text-5xl tracking-tighter text-brand sm:text-6xl">
                  {stat.value}
                </span>
                {stat.suffix ? (
                  <span className="text-lg font-medium text-muted-foreground">
                    {stat.suffix}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Integrations */}
        <div className="reveal mt-14 flex flex-col items-center gap-5 border-t border-border/60 pt-10 sm:flex-row sm:justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Works with the tools you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="text-base font-semibold tracking-tight text-foreground/60 transition-colors hover:text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
