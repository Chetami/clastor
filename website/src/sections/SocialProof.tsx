import { useReveal } from "@/hooks/useReveal";

const STATS = [
  { value: "~4 hrs", label: "saved on admin each week" },
  { value: "1 click", label: "from a finished lesson to a sent invoice" },
  { value: "3 days", label: "typical time from invoice to paid" },
];

const INTEGRATIONS = ["Google Calendar", "Google Meet", "Stripe"];

export function SocialProof() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="px-5 py-8 sm:px-6 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal doodle-card flex flex-col items-center gap-6 rounded-3xl px-5 py-6 sm:px-10">
          <div className="grid w-full gap-6 text-center sm:grid-cols-3 sm:gap-12">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <b className="font-display text-[clamp(1.75rem,3.4vw,2.375rem)] leading-tight text-brand">
                  {stat.value}
                </b>
                <span className="max-w-[22ch] text-sm leading-snug text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
              Works with
            </span>
            {INTEGRATIONS.map((name, i) => (
              <span key={name} className="flex items-center gap-3">
                <strong className="font-semibold text-foreground">{name}</strong>
                {i < INTEGRATIONS.length - 1 && (
                  <span className="text-border">·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
