import { BookOpen, CalendarCheck, CalendarPlus, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "@/features/auth/BrandMark";
import { FOUNDERS } from "../founders";

type WelcomeStepProps = {
  /** Tutors who already granted Calendar access skip the calendar item. */
  googleConnected: boolean;
};

/**
 * Intro step. Sells the journey, not the team: a short, concrete preview of
 * everything the wizard sets up, so tutors click "Get started" knowing
 * exactly what a couple of minutes buys them. Founders get a one-line
 * mention — photos and direct contact live on the final step instead, once
 * the tutor has actually used the product. The wizard page owns navigation.
 */
export function WelcomeStep({ googleConnected }: WelcomeStepProps) {
  const items: { icon: LucideIcon; label: string }[] = [
    { icon: BookOpen, label: "The subjects you teach" },
    { icon: UserPlus, label: "Your first student" },
    { icon: CalendarPlus, label: "Your first lesson, booked" },
    ...(googleConnected
      ? []
      : [{ icon: CalendarCheck, label: "Your calendar, synced" }]),
  ];

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <BrandMark size={56} showName={false} />

      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to Clastor
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          A couple of minutes is all it takes. Here's what you'll have ready
          by the end:
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-2">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg border p-3 text-left"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Built by {FOUNDERS.map((f) => f.name).join(" & ")} — we'd love to
        hear from you.
      </p>
    </div>
  );
}
