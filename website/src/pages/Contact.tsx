import { useState } from "react";
import { Mail, Clock, MessageSquare, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Contact page.
 *
 * The form is presentational only — it does not submit anywhere yet. The real
 * contact channel is the email address below. Wire the submit handler up to a
 * backend / form service when ready.
 */

const TOPICS = [
  "General question",
  "Sales & plans",
  "Support / billing",
  "Partnerships & teams",
  "Press",
] as const;

const CONTACT_EMAIL = "info@xamify.com.au";

const FIELD =
  "w-full rounded-2xl border-[2.5px] border-foreground bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30";

const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";

export default function ContactPage() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>(TOPICS[0]);

  return (
    <section className="px-5 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-36 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12 max-w-[660px] sm:mb-14">
          <p className="eyebrow">Contact</p>
          <h1 className="mt-3.5 font-display text-[clamp(2rem,5.6vw,3.5rem)] leading-[1.1]">
            Talk to a <span className="display-accent">real person.</span>
          </h1>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(1rem,1.6vw,1.1875rem)] text-muted-foreground">
            Questions about Clastor, pricing, or moving a team over? Send a note
            and we&apos;ll get back to you — no chatbots, no ticket queue.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          {/* Info column */}
          <aside className="flex flex-col gap-5">
            <article className="doodle-card flex flex-col gap-5 rounded-3xl bg-secondary p-7 shadow-sketch-lg sm:p-8">
              <div>
                <h2 className="mb-3 font-display text-2xl">Reach us directly</h2>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="group inline-flex items-center gap-2.5 text-lg text-foreground transition-colors hover:text-brand"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-foreground bg-card text-brand">
                    <Mail className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  {CONTACT_EMAIL}
                </a>
              </div>

              <div className="flex items-start gap-3 border-t-2 border-dashed border-foreground/25 pt-4 text-base text-muted-foreground">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={2.2} />
                <span>
                  We reply within{" "}
                  <b className="text-foreground">one business day</b>, usually
                  sooner.
                </span>
              </div>
            </article>

            <article className="doodle-card flex flex-col gap-3 rounded-3xl p-7 sm:p-8">
              <h2 className="font-display text-2xl">Help us help you</h2>
              <p className="text-base text-muted-foreground">
                The more context, the faster we can answer:
              </p>
              <ul className="flex flex-col gap-2.5">
                {[
                  "How many students you tutor",
                  "What you currently use to schedule & invoice",
                  "Anything specific you\u2019re trying to solve",
                ].map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-base text-foreground"
                  >
                    <Check
                      className="mt-1 h-4 w-4 shrink-0 text-[hsl(143_54%_28%)]"
                      strokeWidth={2.5}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          </aside>

          {/* Form column */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="doodle-card flex flex-col gap-5 rounded-3xl p-7 shadow-sketch-lg sm:p-8"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-foreground bg-brand text-foreground shadow-sketch">
                <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <h2 className="font-display text-2xl">Send a message</h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={LABEL}>
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Maya Reynolds"
                  className={FIELD}
                />
              </div>
              <div>
                <label htmlFor="email" className={LABEL}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={FIELD}
                />
              </div>
            </div>

            <div>
              <label htmlFor="topic" className={LABEL}>
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                value={topic}
                onChange={(e) =>
                  setTopic(e.target.value as (typeof TOPICS)[number])
                }
                className={FIELD}
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 flex-col">
              <label htmlFor="message" className={LABEL}>
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                placeholder="Tell us what you're trying to do…"
                className={`${FIELD} min-h-[160px] resize-y`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed border-border pt-5">
              <p className="max-w-[34ch] text-sm text-muted-foreground">
                Prefer email? Write to us directly at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="border-b-2 border-[hsl(25_100%_80%)] text-brand hover:border-brand"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
              <Button type="submit" variant="brand" size="lg">
                Send message
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
