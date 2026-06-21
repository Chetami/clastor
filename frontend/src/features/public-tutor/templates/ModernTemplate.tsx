import { Mail } from "lucide-react";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Modern template — split hero with a colored side panel and a denser,
 * card-based layout for the details. Same data shape as Classic.
 */
export function ModernTemplate({
  profile,
}: {
  profile: PublicTutorProfileResponse;
}) {
  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasPricing = profile.hourlyRate != null;
  const ctaLabel = profile.ctaText?.trim() || "Get in touch";

  return (
    <div className="min-h-dvh bg-background">
      {/* Split hero */}
      <header className="grid sm:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4 bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <Avatar className="size-20 rounded-2xl border-2 border-primary-foreground/30">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={profile.name} />
            )}
            <AvatarFallback className="rounded-2xl bg-primary-foreground/15 text-2xl text-primary-foreground">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {profile.name}
            </h1>
            {profile.headline && (
              <p className="text-lg text-primary-foreground/80">
                {profile.headline}
              </p>
            )}
          </div>
          {hasPricing && (
            <p className="text-sm font-medium text-primary-foreground/90">
              From {profile.currency} {Number(profile.hourlyRate).toFixed(2)} / hour
            </p>
          )}
          {profile.contactEmail && (
            <Button
              asChild
              variant="secondary"
              className="mt-2 w-fit"
            >
              <a href={`mailto:${profile.contactEmail}`}>
                <Mail className="size-4" />
                {ctaLabel}
              </a>
            </Button>
          )}
        </div>

        <div className="flex items-center bg-muted/40 px-6 py-12 sm:px-12">
          {profile.bio ? (
            <p className="whitespace-pre-line text-lg leading-relaxed text-foreground/90">
              {profile.bio}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {profile.name} hasn't added an introduction yet.
            </p>
          )}
        </div>
      </header>

      {/* Detail grid */}
      {(profile.subjects.length > 0 || profile.qualifications.length > 0) && (
        <section className="mx-auto grid max-w-4xl gap-6 px-6 py-12 sm:grid-cols-2 sm:px-12">
          {profile.subjects.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Subjects
              </h2>
              <ul className="flex flex-wrap gap-2">
                {profile.subjects.map((subject, i) => (
                  <li
                    key={i}
                    className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  >
                    {subject}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile.qualifications.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Qualifications
              </h2>
              <ul className="space-y-2">
                {profile.qualifications.map((q, i) => (
                  <li key={i} className="flex gap-2 text-foreground/90">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {profile.contactEmail && (
        <section className="mx-auto max-w-4xl px-6 pb-16 sm:px-12">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <p className="text-lg font-medium">
              Ready to start learning with {profile.name.split(" ")[0]}?
            </p>
            <Button asChild>
              <a href={`mailto:${profile.contactEmail}`}>
                <Mail className="size-4" />
                {ctaLabel}
              </a>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
