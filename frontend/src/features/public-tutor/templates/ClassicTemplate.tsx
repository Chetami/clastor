import { Mail } from "lucide-react";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function ClassicTemplate({
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
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/* Header */}
      <header className="flex flex-col items-center gap-5 text-center">
        <Avatar className="size-28 rounded-full">
          {profile.avatarUrl && (
            <AvatarImage src={profile.avatarUrl} alt={profile.name} />
          )}
          <AvatarFallback className="rounded-full text-3xl">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {profile.name}
          </h1>
          {profile.headline && (
            <p className="text-lg text-muted-foreground">
              {profile.headline}
            </p>
          )}
          {hasPricing && (
            <p className="text-sm font-medium text-foreground">
              {profile.currency} {Number(profile.hourlyRate).toFixed(2)} / hour
            </p>
          )}
        </div>

        {profile.contactEmail && (
          <Button asChild size="lg" className="mt-1">
            <a href={`mailto:${profile.contactEmail}`}>
              <Mail className="size-4" />
              {ctaLabel}
            </a>
          </Button>
        )}
      </header>

      {/* Bio */}
      {profile.bio && (
        <section className="mt-12">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            About
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        </section>
      )}

      {/* Subjects */}
      {profile.subjects.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Subjects
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.subjects.map((subject, i) => (
              <li
                key={i}
                className="rounded-full border border-input bg-muted/40 px-3 py-1 text-sm"
              >
                {subject}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Qualifications */}
      {profile.qualifications.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Qualifications
          </h2>
          <ul className="space-y-2">
            {profile.qualifications.map((q, i) => (
              <li key={i} className="flex gap-2 leading-relaxed text-foreground/90">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Trailing contact */}
      {profile.contactEmail && (
        <section className="mt-12 flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-6 text-center">
          <p className="text-lg font-medium">Interested in working together?</p>
          <Button asChild>
            <a href={`mailto:${profile.contactEmail}`}>
              <Mail className="size-4" />
              {ctaLabel}
            </a>
          </Button>
        </section>
      )}
    </article>
  );
}
