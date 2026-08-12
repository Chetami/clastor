import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinWaitlistRequest, toSignupSurvey, type SurveyAnswers } from "@examify-tms/shared";
import { track } from "@/lib/analytics";

export function WaitlistStep({
  answers,
}: {
  answers: SurveyAnswers;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const waitlist = useMutation({
    mutationFn: (e: string) =>
      joinWaitlistRequest(e, toSignupSurvey(answers)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    track("signup_waitlist_join", { intent: answers.intent });
    waitlist.mutate(email);
  }

  useEffect(() => {
    if (waitlist.isSuccess) setSubmitted(true);
  }, [waitlist.isSuccess]);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Check className="size-7" strokeWidth={3} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            You're on the list
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            We'll reach out at{" "}
            <span className="font-medium text-foreground">{email}</span> as
            soon as organisation features are ready. Expect to hear from us
            soon.
          </p>
        </div>
        <Button variant="outline" size="lg" className="w-full max-w-md" asChild>
          <Link to="/">
            Back to home
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          Rather not wait? You can still{" "}
          <Link
            to="/signup"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            sign up as an individual tutor
          </Link>{" "}
          right now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Building2 className="size-7" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Organisation features are on the way
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          We're building multi-tutor scheduling, shared invoicing, and team
          dashboards. Drop your email and we'll let you know the moment they
          launch.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-md flex-col gap-2.5 text-left"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="waitlist-email" className="sr-only">
            Email
          </Label>
          <Input
            id="waitlist-email"
            type="email"
            placeholder="you@organisation.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </div>

        {waitlist.isError && (
          <p className="text-sm text-destructive">
            {waitlist.error.message}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="text-base"
          disabled={waitlist.isPending}
        >
          {waitlist.isPending ? "Joining..." : "Join the waitlist"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
        No spam — just a heads-up when it's ready. You can still{" "}
        <Link
          to="/signup"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          sign up as an individual tutor
        </Link>{" "}
        in the meantime.
      </p>
    </div>
  );
}
