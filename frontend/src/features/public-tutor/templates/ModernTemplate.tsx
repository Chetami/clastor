import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  ContactButton,
  ProfileAvatar,
  QualificationList,
  SectionTitle,
  SubjectChips,
  formatRate,
  getCtaLabel,
} from "./blocks";

/**
 * Modern template — split hero with a colored side panel and a denser,
 * card-based layout for the details. Same data shape as Classic.
 */
export function ModernTemplate({
  profile,
}: {
  profile: PublicTutorProfileResponse;
}) {
  const ctaLabel = getCtaLabel(profile);
  const rate = formatRate(profile);
  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-dvh bg-background">
      {/* Split hero */}
      <header className="grid sm:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4 bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <ProfileAvatar
            profile={profile}
            className="size-20 rounded-2xl border-2 border-primary-foreground/30"
            fallbackClassName="rounded-2xl bg-primary-foreground/15 text-2xl text-primary-foreground"
          />
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
          {rate && (
            <p className="text-sm font-medium text-primary-foreground/90">
              From {rate} / hour
            </p>
          )}
          <ContactButton
            email={profile.contactEmail}
            label={ctaLabel}
            variant="secondary"
            className="mt-2 w-fit"
          />
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
              <SectionTitle className="mb-4">Subjects</SectionTitle>
              <SubjectChips
                subjects={profile.subjects}
                chipClassName="bg-primary/10 font-medium text-primary"
              />
            </div>
          )}
          {profile.qualifications.length > 0 && (
            <div className="rounded-2xl border bg-card p-6">
              <SectionTitle className="mb-4">Qualifications</SectionTitle>
              <QualificationList
                qualifications={profile.qualifications}
                textClassName="text-foreground/90"
              />
            </div>
          )}
        </section>
      )}

      {profile.contactEmail && (
        <section className="mx-auto max-w-4xl px-6 pb-16 sm:px-12">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <p className="text-lg font-medium">
              Ready to start learning with {firstName}?
            </p>
            <ContactButton email={profile.contactEmail} label={ctaLabel} />
          </div>
        </section>
      )}
    </div>
  );
}
