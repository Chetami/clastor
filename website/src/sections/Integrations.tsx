import { useReveal } from "@/hooks/useReveal";
import { Sparkle, Star } from "@/components/Doodles";
import {
  GoogleCalendarIcon,
  GoogleMeetIcon,
  StripeIcon,
} from "@/components/BrandIcons";

interface Integration {
  Icon: typeof GoogleCalendarIcon;
  name: string;
  description: string;
}

const INTEGRATIONS: Integration[] = [
  {
    Icon: GoogleCalendarIcon,
    name: "Google Calendar",
    description: "Two-way sync — all lessons land on your calendar.",
  },
  {
    Icon: GoogleMeetIcon,
    name: "Google Meet",
    description: "Join links auto-generated for online lessons.",
  },
  {
    Icon: StripeIcon,
    name: "Stripe",
    description: "Card payments without the awkward chase.",
  },
];

export function Integrations() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="integrations"
      className="relative scroll-mt-20 overflow-hidden px-5 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 lg:px-8"
    >
      {/* Hand-drawn accent in the margin. */}
      <Star className="pointer-events-none absolute left-[5%] top-[6%] hidden h-7 w-7 rotate-6 text-brand/45 sm:block" />
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-9 max-w-[660px]">
          <p className="eyebrow">Integrations</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.75rem,4vw,2.625rem)] leading-[1.12]">
            Plugs into your existing workflow
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            No ripping and replacing your calendar or your bank. Clastor sits
            alongside the apps you trust.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {INTEGRATIONS.map(({ Icon, name, description }, i) => (
            <li
              key={name}
              className="reveal doodle-card flex flex-col gap-3 rounded-3xl p-6"
              style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
            >
              <Icon className="h-12 w-12" />
              <div>
                <h3 className="font-display text-2xl leading-tight">{name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="reveal mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <Sparkle className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span>
            We&apos;re actively adding more.{" "}
            <a
              href="mailto:info@xamify.com.au?subject=Request%20an%20integration"
              className="border-b-2 border-[hsl(25_100%_80%)] text-brand hover:border-brand"
            >
              Request an integration
            </a>{" "}
            and we&apos;ll bump it up the list.
          </span>
        </p>
      </div>
    </section>
  );
}
