import { useReveal } from "@/hooks/useReveal";
import { Sparkle } from "@/components/Doodles";
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
    description: "Two-way sync — every lesson lands on your calendar.",
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
      className="scroll-mt-20 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="reveal mb-9 max-w-[660px]">
          <p className="eyebrow">Integrations</p>
          <h2 className="mt-3.5 font-display text-[clamp(1.75rem,4vw,2.625rem)] leading-[1.12]">
            Works with the tools you already use.
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
            No ripping and replacing your calendar or your bank. Clastor sits
            alongside the apps you trust.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {INTEGRATIONS.map(({ Icon, name, description }, i) => (
            <li
              key={name}
              className="reveal doodle-card flex flex-col gap-3 rounded-3xl p-6 transition-transform duration-300 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-sketch-lg"
              style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
            >
              <Icon className="h-12 w-12" />
              <div>
                <h3 className="font-display text-2xl leading-tight">{name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
