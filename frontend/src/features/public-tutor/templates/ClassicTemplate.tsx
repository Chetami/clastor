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

export function ClassicTemplate({
  profile,
}: {
  profile: PublicTutorProfileResponse;
}) {
  const ctaLabel = getCtaLabel(profile);
  const rate = formatRate(profile);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/* Header */}
      <header className="flex flex-col items-center gap-5 text-center">
        <ProfileAvatar
          profile={profile}
          className="size-28 rounded-full"
          fallbackClassName="rounded-full text-3xl"
        />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {profile.name}
          </h1>
          {profile.headline && (
            <p className="text-lg text-muted-foreground">
              {profile.headline}
            </p>
          )}
          {rate && (
            <p className="text-sm font-medium text-foreground">
              {rate} / hour
            </p>
          )}
        </div>

        <ContactButton
          email={profile.contactEmail}
          label={ctaLabel}
          size="lg"
          className="mt-1"
        />
      </header>

      {/* Bio */}
      {profile.bio && (
        <section className="mt-12">
          <SectionTitle className="mb-3">About</SectionTitle>
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        </section>
      )}

      {/* Subjects */}
      {profile.subjects.length > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-3">Subjects</SectionTitle>
          <SubjectChips
            subjects={profile.subjects}
            chipClassName="border border-input bg-muted/40"
          />
        </section>
      )}

      {/* Qualifications */}
      {profile.qualifications.length > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-3">Qualifications</SectionTitle>
          <QualificationList
            qualifications={profile.qualifications}
            textClassName="text-foreground/90"
          />
        </section>
      )}

      {/* Trailing contact */}
      {profile.contactEmail && (
        <section className="mt-12 flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-6 text-center">
          <p className="text-lg font-medium">
            Interested in working together?
          </p>
          <ContactButton email={profile.contactEmail} label={ctaLabel} />
        </section>
      )}
    </article>
  );
}
