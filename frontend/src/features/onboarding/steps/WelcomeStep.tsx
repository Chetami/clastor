import { Mail } from "lucide-react"; // [1] Added Mail import

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/features/auth/BrandMark";
import { FOUNDERS } from "../founders";

/**
 * Intro step. Sets a personal tone and surfaces the founders up-front so new
 * tutors know real humans are behind Clastor. The wizard page owns navigation.
 */
export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <BrandMark size={56} showName={false} />

      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to Clastor
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Let's get you set up in a couple of minutes. By the end of this guide,
          you'll have your first student added and your calendar ready to
          go.{" "}
        </p>
      </div>

      <div className="w-full rounded-lg border bg-muted/30 p-5">
        <p className="text-sm font-medium">We're here if you need anything</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          We're a small team and we'd love to hear from you. Feel free to reach
          out directly — no support queue, just us.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {FOUNDERS.map((founder) => (
            <div
              key={founder.name}
              className="flex w-32 flex-col items-center gap-2"
            >
              <Avatar className="size-16 border">
                <AvatarImage src={founder.photo} alt={founder.name} />
                <AvatarFallback className="text-sm font-medium">
                  {founder.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {founder.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {founder.role}
                </span>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5" // [2] Added gap-1.5 for consistent icon spacing
              >
                <a href={founder.contactHref}>
                  <Mail className="size-3.5 shrink-0" />{" "}
                  {/* [3] Added the icon */}
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
