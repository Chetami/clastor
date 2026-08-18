import { Mail } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FOUNDERS } from "../founders";

/**
 * Founders contact card — the one place in onboarding where new tutors meet
 * the humans behind Clastor, with a direct line to each founder. Shown on
 * the final step, after the tutor has actually used the product, so the
 * "message us directly" offer lands as actionable rather than premature.
 */
export function FoundersContactCard() {
  return (
    <div className="w-full rounded-lg border bg-muted/30 p-5">
      <p className="text-sm font-medium">Thanks for giving Clastor a go</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        If anything feels confusing or you have an idea to share, message us
        directly. We read and reply to every single message.
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
  );
}
