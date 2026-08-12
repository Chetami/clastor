import { useState } from "react";

import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

interface QA {
  question: string;
  answer: string;
}

const FAQS: QA[] = [
  {
    question: "Does it sync with Google Calendar?",
    answer:
      "Yes — two-way sync with Google Calendar. Block a lesson in Clastor and it appears on your Google Calendar; mark yourself busy on Google and Clastor respects it. Reminders are sent through Clastor regardless.",
  },
  {
    question: "Is my students' data safe?",
    answer:
      "Data is encrypted in transit and at rest, stored in the EU, and never sold. You can export everything as a spreadsheet at any time, and delete your account along with all records whenever you choose.",
  },
  {
    question: "I'm not very tech-savvy — is it hard to set up?",
    answer:
      "Most tutors are fully set up in under 15 minutes. There's no software to install — it runs in the browser and on your phone. If you can use a calendar, you can use Clastor.",
  },
  {
    question: "I only have a few students. Is it worth it?",
    answer:
      "Clastor is free for your first 10 students. If you teach fewer than that, the reminders, branded invoices, and calendar sync still save you an evening a week — and they make you look established to new families.",
  },
  {
    question: "How do payments work? Do I need Stripe?",
    answer:
      "Stripe powers card payments behind the scenes, but you don't need an existing Stripe account — Clastor guides you through connecting one in a couple of minutes. Prefer bank transfer or cash? You can mark invoices paid manually and Clastor keeps the records tidy.",
  },
  {
    question: "Can I use it with my tutoring team?",
    answer:
      "Yes. Invite a colleague to a shared workspace, keep one student record across tutors, and choose split or pooled invoicing. Per-tutor filters keep everyone's schedule legible at a glance.",
  },
  {
    question: "Will my invoices look professional?",
    answer:
      "That's the point. Each invoice carries your name, subject, and logo on a clean template — the same one whether it's your first student or your fortieth. Parents regularly comment on how polished it looks.",
  },
];

export function FAQ() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="faq" className="scroll-mt-20 px-5 pt-0 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div ref={ref} className="mx-auto max-w-[1180px]">
        <div className="grid items-start gap-7 lg:grid-cols-[1fr_2fr] lg:gap-16">
          {/* Sidebar heading */}
          <div className="reveal">
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3.5 font-display text-[clamp(1.75rem,4vw,2.625rem)] leading-tight">
              Questions, answered.
            </h2>
            <p className="mt-3.5 max-w-[30ch] text-base text-muted-foreground">
              Still wondering something?{" "}
              <a
                href="#top"
                className="border-b-2 border-[hsl(25_100%_80%)] text-brand hover:border-brand"
              >
                Talk to a real tutor
              </a>{" "}
              who uses Clastor.
            </p>
          </div>

          {/* Accordion */}
          <div className="reveal border-t-2 border-border">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} faq={faq} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQItem({ faq }: { faq: QA }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b-2 border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-5 py-5 text-left font-display text-[clamp(1.125rem,1.9vw,1.3125rem)] leading-snug text-foreground transition-colors hover:text-brand"
        aria-expanded={open}
      >
        {faq.question}
        <span
          className={cn(
            "relative h-7 w-7 shrink-0 rounded-full border-2 border-foreground transition-colors",
            open ? "bg-brand" : "bg-card",
          )}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-1/2 h-[2.5px] w-3 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground" />
          <span
            className={cn(
              "absolute left-1/2 top-1/2 h-3 w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded bg-foreground transition-transform duration-200",
              open && "rotate-90",
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-[62ch] pb-6 text-base leading-relaxed text-muted-foreground">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
