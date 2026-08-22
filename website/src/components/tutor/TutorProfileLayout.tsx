import { Banknote, CalendarCheck, Globe, MapPin } from "lucide-react";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  AvailabilityList,
  ContactButton,
  DetailBadges,
  Stars,
  SectionTitle,
  SubjectChips,
  TutorAvatar,
} from "./blocks";
import { formatRate, formatYearsExperience, getCtaLabel } from "@/lib/profile-utils";

/**
 * The single public tutor page layout (no templates) — an info-dense,
 * directory-style profile: photo-first header card, a two-column body with
 * the About/Subjects/Qualifications/Reviews content on the left and a facts
 * sidebar (rate, location, availability, contact) on the right. Styled in
 * the site's doodle design system; mirrors the app's preview layout.
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
  if (rate)
    facts.push({ icon: Banknote, label: "Hourly rate", value: `${rate} / hr` });
  if (profile.location)
    facts.push({ icon: MapPin, label: "Location", value: profile.location });
  if (profile.teachesOnline)
    facts.push({ icon: Globe, label: "Online", value: "Teaches online" });
  const experience = formatYearsExperience(profile.yearsExperience);
  if (experience)
    facts.push({ icon: CalendarCheck, label: "Experience", value: experience });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-32 sm:px-6 lg:px-9">
      {/* Photo-first header */}
      <header className="grid gap-6 rounded-3xl border-[2.5px] border-foreground bg-card p-6 shadow-sketch sm:grid-cols-[220px_1fr] sm:p-8">
        <TutorAvatar
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          className="aspect-[4/5] w-full max-w-[220px] text-5xl"
        />
        <div className="flex flex-col justify-center gap-3">
          <div>
            <h1 className="font-display text-4xl leading-tight tracking-tightest sm:text-5xl">
              {profile.name}
            </h1>
            {profile.headline && (
              <p className="mt-1 text-lg text-muted-foreground">
                {profile.headline}
              </p>
            )}
          </div>
          {hasRating && (
            <Stars
              ratingAvg={profile.ratingAvg}
              reviewCount={profile.reviewCount}
            />
          )}
          <DetailBadges
            location={profile.location}
            teachesOnline={profile.teachesOnline}
            yearsExperience={profile.yearsExperience}
          />
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <ContactButton email={profile.contactEmail} label={ctaLabel} size="lg" />
            {rate && (
              <span className="font-mono text-sm font-bold uppercase tracking-[0.08em]">
                From {rate} / hour
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          {profile.bio && (
            <section>
              <SectionTitle className="mb-3">About</SectionTitle>
              <p className="whitespace-pre-line text-lg leading-relaxed">
                {profile.bio}
              </p>
            </section>
          )}

          {profile.subjects.length > 0 && (
            <section>
              <SectionTitle className="mb-3">
                Subjects ({profile.subjects.length})
              </SectionTitle>
              <SubjectChips subjects={profile.subjects} />
            </section>
          )}

          {profile.qualifications.length > 0 && (
            <section>
              <SectionTitle className="mb-3">Qualifications</SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {profile.qualifications.map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {children}
        </div>

        {/* Facts sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {facts.length > 0 && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-card p-5 shadow-sketch">
              <SectionTitle className="mb-3">Details</SectionTitle>
              <dl className="space-y-3">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-brand"
                      aria-hidden
                    />
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="text-sm font-semibold">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(profile.availability?.length ?? 0) > 0 && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-card p-5 shadow-sketch">
              <SectionTitle className="mb-3">Availability</SectionTitle>
              <AvailabilityList availability={profile.availability!} />
            </div>
          )}

          {profile.contactEmail && (
            <div className="rounded-3xl border-[2.5px] border-foreground bg-secondary/50 p-5 text-center shadow-sketch">
              <p className="font-display text-lg leading-snug">
                Ready to start learning with {firstName}?
              </p>
              <ContactButton
                email={profile.contactEmail}
                label={ctaLabel}
                variant="outline"
                className="mt-3 w-full"
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default TutorProfileLayout;
