import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  ReceiptText,
  Users,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/SectionHeading";
import { useReveal } from "@/hooks/useReveal";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Users,
    title: "Student management",
    description:
      "Keep every student's details, subjects, rates, and notes in one place — so you never hunt through a spreadsheet again.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling & calendar",
    description:
      "A drag-and-drop calendar for one-off or recurring lessons that syncs two-way with Google Calendar. Booking takes seconds.",
  },
  {
    icon: ReceiptText,
    title: "Invoicing & payments",
    description:
      "Turn unpaid lessons into a polished, itemized invoice in a click — then get paid online with Stripe. No more chasing.",
  },
  {
    icon: BookOpenCheck,
    title: "Lesson tracking",
    description:
      "Log attendance, track progress, and capture notes for every session. Makeup credits are handled automatically.",
  },
  {
    icon: MessageSquareText,
    title: "Communication tools",
    description:
      "Automatic calendar invites, reminders on a schedule, and one-tap RSVP. Students always know what's on — and show up.",
  },
  {
    icon: BarChart3,
    title: "Business insights",
    description:
      "See expected vs. actual income, hours taught, and what needs attention. Know exactly how your business is doing.",
  },
];

export function Features() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="scroll-mt-20 py-24 sm:py-28">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything your tutoring business needs"
          description="One connected system — not a patchwork of apps. Each part works with the others, so the busywork happens automatically."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <Card
      className="reveal group h-full transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
      style={{ ["--reveal-delay" as string]: `${index * 60}ms` }}
    >
      <CardContent className="flex h-full flex-col p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
          {feature.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </CardContent>
    </Card>
  );
}
