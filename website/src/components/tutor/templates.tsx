import type { PublicTutorProfileResponse, TutorTemplate } from "@examify-tms/interfaces";
import {
  AvailabilityList,
  ContactButton,
  DetailBadges,
  SectionTitle,
  Stars,
  SubjectChips,
  TutorAvatar,
} from "./blocks";
import { getCtaLabel, formatRate } from "@/lib/profile-utils";

/**
 * Public tutor profile layouts, ported 1:1 from the app's template registry
 * (frontend/src/features/public-tutor/templates) and restyled in the site's
 * doodle design system. The same information architecture renders in both
 * places so the editor's live preview matches what visitors see here.
 */

export function ClassicTemplate({
  profile,
}: {
  profile: PublicTutorProfileResponse;
}) {
  const ctaLabel = getCtaLabel(profile);
  const rate = formatRate(profile);
  const hasRating = profile.ratingAvg != null && profile.reviewCount > 0;

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="flex flex-col items-center gap-5 text-center">
        <TutorAvatar
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          className="size-28 rounded-full"
        />

        <div className="space-y-2">
          <h1 className="font-display text-4xl leading-tight tracking-tightest sm:text-5xl">
            {profile.name}
          </h1>
          {profile.headline && (
            <p className="text-lg text-muted-foreground">{profile.headline}</p>
          )}
          {hasRating && (
            <div className="flex justify-center">
              <Stars ratingAvg={profile.ratingAvg} reviewCount={profile.reviewCount} />
            </div>
          )}
          {rate && (
            <p className="text-sm font-semibold">From {rate} / hour</p>
          )}
        </div>

        <DetailBadges
          location={profile.location}
          teachesOnline={profile.teachesOnline}
          yearsExperience={profile.yearsExperience}
        />

        <ContactButton
          email={profile.contactEmail}
          label={ctaLabel}
          size="lg"
          className="mt-1"
        />
      </header>

      {profile.bio && (
        <section className="mt-12">
          <SectionTitle className="mb-3">About</SectionTitle>
          <p className="whitespace-pre-line text-lg leading-relaxed">
            {profile.bio}
          </p>
        </section>
      )}

      {profile.subjects.length > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-3">Subjects</SectionTitle>
          <SubjectChips subjects={profile.subjects} />
        </section>
      )}

      {(profile.availability?.length ?? 0) > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-3">Availability</SectionTitle>
          <AvailabilityList availability={profile.availability!} />
        </section>
      )}

      {profile.qualifications.length > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-3">Qualifications</SectionTitle>
          <ul className="space-y-2">
            {profile.qualifications.map((q) => (
              <li key={q} className="flex gap-2">
                <span className="mt-2.5 size-2 shrink-0 rounded-full bg-brand" />
                <span className="leading-relaxed">{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.contactEmail && (
        <section className="mt-12 flex flex-col items-center gap-3 rounded-3xl border-[2.5px] border-foreground bg-secondary/50 p-6 text-center shadow-sketch">
          <p className="font-display text-xl">Interested in working together?</p>
          <ContactButton email={profile.contactEmail} label={ctaLabel} variant="outline" />
        </section>
      )}
    </article>
  );
}

export function ModernTemplate({
  profile,
}: {
  profile: PublicTutorProfileResponse;
}) {
  const ctaLabel = getCtaLabel(profile);
  const rate = formatRate(profile);
  const firstName = profile.name.split(" ")[0];
  const hasRating = profile.ratingAvg != null && profile.reviewCount > 0;
  const hasBadges =
    profile.location || profile.teachesOnline || profile.yearsExperience != null;

  return (
    <div>
      <header className="grid sm:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4 border-b-[2.5px] border-foreground bg-brand px-6 py-12 sm:border-b-0 sm:border-r-[2.5px] sm:px-12">
          <TutorAvatar
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            className="size-20 bg-card"
          />
          <div className="space-y-2">
            <h1 className="font-display text-4xl leading-tight tracking-tightest sm:text-5xl">
              {profile.name}
            </h1>
            {profile.headline && (
              <p className="text-lg opacity-80">{profile.headline}</p>
            )}
            {hasRating && <Stars ratingAvg={profile.ratingAvg} reviewCount={profile.reviewCount} />}
          </div>
          {hasBadges && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {[
                ...(profile.location
                  ? [{ label: profile.location, icon: "pin" as const }]
                  : []),
                ...(profile.teachesOnline
                  ? [{ label: "Teaches online", icon: "globe" as const }]
                  : []),
              ].map(({ label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 text-sm">
                  <span className="size-1.5 rounded-full bg-foreground" />
                  {label}
                </li>
              ))}
              {profile.yearsExperience != null && (
                <li className="inline-flex items-center gap-1.5 text-sm">
                  <span className="size-1.5 rounded-full bg-foreground" />
                  {profile.yearsExperience}{" "}
                  {profile.yearsExperience === 1 ? "year" : "years"} tutoring
                </li>
              )}
            </ul>
          )}
          {rate && <p className="text-sm font-semibold">From {rate} / hour</p>}
          <ContactButton
            email={profile.contactEmail}
            label={ctaLabel}
            variant="outline"
            className="mt-2 w-fit"
          />
        </div>

        <div className="flex items-center bg-secondary/30 px-6 py-12 sm:px-12">
          {profile.bio ? (
            <p className="whitespace-pre-line text-lg leading-relaxed">
              {profile.bio}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {profile.name} hasn't added an introduction yet.
            </p>
          )}
        </div>
      </header>

      {(profile.subjects.length > 0 ||
        profile.qualifications.length > 0 ||
        (profile.availability?.length ?? 0) > 0) && (
        <section className="mx-auto grid max-w-4xl gap-6 px-6 py-12 sm:grid-cols-2 sm:px-12">
          {profile.subjects.length > 0 && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-card p-6 shadow-sketch">
              <SectionTitle className="mb-4">Subjects</SectionTitle>
              <SubjectChips subjects={profile.subjects} />
            </div>
          )}
          {(profile.availability?.length ?? 0) > 0 && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-card p-6 shadow-sketch">
              <SectionTitle className="mb-4">Availability</SectionTitle>
              <AvailabilityList availability={profile.availability!} />
            </div>
          )}
          {profile.qualifications.length > 0 && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-card p-6 shadow-sketch">
              <SectionTitle className="mb-4">Qualifications</SectionTitle>
              <ul className="space-y-2">
                {profile.qualifications.map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
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
          <div className="flex flex-col items-center gap-3 rounded-3xl border-[2.5px] border-foreground bg-card p-8 text-center shadow-sketch">
            <p className="font-display text-2xl">
              Ready to start learning with {firstName}?
            </p>
            <ContactButton email={profile.contactEmail} label={ctaLabel} />
          </div>
        </section>
      )}
    </div>
  );
}

const TEMPLATES: Record<
  TutorTemplate,
  (props: { profile: PublicTutorProfileResponse }) => React.JSX.Element
> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
};

export default TEMPLATES;
