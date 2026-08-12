import { useEffect } from "react";
import { Check, Mail } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fireConfettiCannons } from "@/lib/confetti";
import { FOUNDERS } from "../founders";

/**
 * Final step. Celebrates completion and reinforces the personal touch with a
 * second founders contact point. The wizard's "Finish" button (owned by the
 * page) marks onboarding complete and sends them to the dashboard.
 */
const CONFETTI_KEY = "onboardingConfettiFired";

export function FinishStep() {
  // Fire the confetti cannons once per browser session — Back→forward remounts
  // this step, so without this guard it would fire again each time.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CONFETTI_KEY)) return;
      sessionStorage.setItem(CONFETTI_KEY, "1");
    } catch {
      // ignore — fall through and still fire once this mount
    }
    fireConfettiCannons();
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          You're all set!
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          And just like that, your first student is set up and your calendar is
          ready. Your new tutoring home is completely tailored and waiting for
          you.{" "}
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-3">
        {[
          "Students, organised",
          "Lessons, scheduled",
          "Invoices, ready to send",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium"
          >
            <Check className="size-4 text-emerald-500" />
            {item}
          </div>
        ))}
      </div>

      <div className="w-full rounded-lg border bg-muted/30 p-5">
        <p className="text-sm font-medium">Thanks for giving Clastor a go</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          If anything feels confusing or you have an idea to share, message us
          directly. We read and reply to every single message.{" "}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {FOUNDERS.map((founder) => (
            <div
              key={founder.name}
              className="flex w-32 flex-col items-center gap-2"
            >
              <Avatar className="size-14 border">
                <AvatarImage src={founder.photo} alt={founder.name} />
                <AvatarFallback className="text-xs font-medium">
                  {founder.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium leading-tight">
                {founder.name}
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
              >
                <a href={founder.contactHref}>
                  <Mail className="size-3.5 shrink-0" />
                  {founder.contactLabel}
                </a>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
