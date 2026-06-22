import { CalendarCheck, CreditCard, Sparkles, Users } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Users,
    title: "Manage students",
    body: "Keep contacts, notes and lesson history in one place.",
  },
  {
    icon: CalendarCheck,
    title: "Schedule lessons",
    body: "Book sessions and auto-generate Google Meet links.",
  },
  {
    icon: CreditCard,
    title: "Get paid",
    body: "Send invoices and accept card payments via Stripe.",
  },
];

/**
 * Intro step. Purely presentational — the wizard page owns navigation.
 */
export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to Clastor
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Your tutoring business, organised. Let's take a minute to set things
          up so your dashboard, schedule and invoices are ready to go.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
          >
            <Icon className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
