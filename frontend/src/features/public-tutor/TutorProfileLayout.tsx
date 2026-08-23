import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  AvailabilityList,
  ContactButton,
  DetailBadges,
  QualificationList,
  RatingStars,
  SectionTitle,
  SubjectChips,
  formatRate,
  getCtaLabel,
} from "./templates/blocks";
import { formatYearsExperience, getInitials } from "@examify-tms/shared";
import { MapPin, Globe } from "lucide-react";

/**
 * The single public tutor page layout — an info-dense, directory-style
 * profile: a photo-first header, a two-column body (main content + facts
 * sidebar), with reviews slotted in as children by the page that owns the
 * data fetch. Mirrored on the marketing website, which serves the public
 * pages in production.
 */
export function TutorProfileLayout({
  profile,
  children,
}: {
  profile: PublicTutorProfileResponse;
  /** Extra main-column content (the reviews section). */
  children?: React.ReactNode;
}) {
  const ctaLabel = getCtaLabel(profile);
  const rate = formatRate(profile);
  const hasRating = profile.ratingAvg != null && profile.reviewCount > 0;
  const firstName = profile.name.split(" ")[0];

  const facts: { icon: typeof MapPin; label: string; value: string }[] = [];
  if (rate) facts.push({ icon: MapPin, label: "Hourly rate", value: `${rate} / hr` });
  if (profile.location)
    facts.push({ icon: MapPin, label: "Location", value: profile.location });
  if (profile.teachesOnline)
    facts.push({ icon: Globe, label: "Online", value: "Teaches online" });
  const experience = formatYearsExperience(profile.yearsExperience);
  if (experience)
    facts.push({ icon: Globe, label: "Experience", value: experience });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {/* Photo-first header */}
      <header className="mt-6 grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-[200px_1fr] sm:p-8">
        <div className="relative aspect-[4/5] w-full max-w-[200px] overflow-hidden rounded-2xl border bg-muted">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-5xl font-medium text-muted-foreground">
              {getInitials(profile.name) || "?"}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {profile.name}
            </h1>
            {profile.headline && (
              <p className="mt-1 text-lg text-muted-foreground">
                {profile.headline}
              </p>
            )}
          </div>
          {hasRating && (
            <RatingStars
              ratingAvg={profile.ratingAvg}
              reviewCount={profile.reviewCount}
            />
          )}
          {(profile.location ||
            profile.teachesOnline ||
            profile.yearsExperience != null) && (
            <DetailBadges
              location={profile.location}
              teachesOnline={profile.teachesOnline}
              yearsExperience={profile.yearsExperience}
            />
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <ContactButton
              email={profile.contactEmail}
              label={ctaLabel}
              size="lg"
            />
            {rate && (
              <span className="text-sm font-medium text-foreground">
                From {rate} / hour
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          {profile.bio && (
            <section>
              <SectionTitle className="mb-3">About</SectionTitle>
              <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                {profile.bio}
              </p>
            </section>
          )}

          {profile.subjects.length > 0 && (
            <section>
              <SectionTitle className="mb-3">
                Subjects ({profile.subjects.length})
              </SectionTitle>
              <SubjectChips
                subjects={profile.subjects}
                chipClassName="border border-input bg-muted/40"
              />
            </section>
          )}

          {profile.qualifications.length > 0 && (
            <section>
              <SectionTitle className="mb-3">Qualifications</SectionTitle>
              <QualificationList
                qualifications={profile.qualifications}
                textClassName="text-foreground/90"
              />
            </section>
          )}

          {children}
        </div>

        {/* Facts sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {facts.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle className="mb-3">Details</SectionTitle>
              <dl className="space-y-3">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(profile.availability?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle className="mb-3">Availability</SectionTitle>
              <AvailabilityList availability={profile.availability!} />
            </div>
          )}

          {profile.contactEmail && (
            <div className="rounded-xl border bg-muted/30 p-5 text-center">
              <p className="text-sm font-medium">
                Ready to start learning with {firstName}?
              </p>
              <ContactButton
                email={profile.contactEmail}
                label={ctaLabel}
                className="mt-3 w-full"
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
