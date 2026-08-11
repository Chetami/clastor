import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

interface QA {
  question: string;
  answer: string;
}

const FAQS: QA[] = [
  {
    question: "I already have a calendar that works. Why switch?",
    answer:
      "A calendar only holds times. Clastor connects the time to the student, the reminder, and the invoice — so nothing slips through. You don't have to ditch Google Calendar either: Clastor syncs two-way with it, so your existing calendar stays your source of truth.",
  },
  {
    question: "Do I have to stop using Google Calendar?",
    answer:
      "No. Clastor syncs two-way with Google Calendar and auto-generates Google Meet links for online lessons. It complements the tools you already use rather than replacing them.",
  },
  {
    question: "I'm not very tech-savvy. Is Clastor hard to learn?",
    answer:
      "Clastor is built to be simple. Onboarding walks you through setup step by step, and it works alongside the Google tools you already know. Most tutors schedule their first lesson within minutes of signing up.",
  },
  {
    question: "Is my students' data safe?",
    answer:
      "Yes. Clastor uses secure Firebase-based authentication with JWT session management. You stay in control of your students' information at all times.",
  },
  {
    question: "I only have a few students right now. Is it overkill?",
    answer:
      "Not at all — Clastor scales from your very first student. In fact, the earlier you start, the less manual catch-up you'll do later. Spreadsheets and ad-hoc notes get harder to maintain as you grow.",
  },
  {
    question: "How do payments work?",
    answer:
      "Clastor has built-in Stripe support. You turn unpaid lessons into an invoice in one click, students pay online via secure Stripe checkout, and the money lands in your bank account — no chasing, no spreadsheet to track who's paid.",
  },
  {
    question: "Can my tutoring team use Clastor together?",
    answer:
      "Yes. Small teams of 2–5 tutors get individual logins, a shared student view, and shared branding. Clastor is built for individuals first, but grows naturally into a small-team setup without the enterprise price tag.",
  },
];

export function FAQ() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="faq"
      className="scroll-mt-20 border-t border-border bg-secondary/40 py-24 sm:py-32"
    >
      <div ref={ref} className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-[1.1] tracking-tighter text-foreground sm:text-5xl">
            Questions, answered.
          </h2>
        </div>

        <div className="reveal mt-12 space-y-3">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} faq={faq} />
          ))}
        </div>

        <div className="reveal mt-12 text-center" style={{ ["--reveal-delay" as string]: "100ms" }}>
          <p className="text-muted-foreground">
            Still curious?{" "}
            <a
              href="#top"
              className="font-semibold text-brand hover:underline"
            >
              Start free
            </a>{" "}
            and explore for yourself.
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQItem({ faq }: { faq: QA }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        open ? "border-brand/30" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-lg tracking-tight text-foreground">
          {faq.question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-brand transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-pretty leading-relaxed text-muted-foreground">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
