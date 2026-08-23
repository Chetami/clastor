import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import { getPublicProfile } from "@/lib/public-api";
import { Logo } from "@/components/Logo";
import { APP_URL } from "@/lib/site";
import { TutorProfileLayout } from "@/components/tutor/TutorProfileLayout";
import { ReviewsSection } from "@/components/tutor/ReviewsSection";
import { Button } from "@/components/ui/button";

/** Browser tab + link-preview metadata for the profile. */
function useProfileMeta(profile: PublicTutorProfileResponse | null) {
  useEffect(() => {
    if (!profile) return;
    const previousTitle = document.title;
    document.title = `${profile.name} | Clastor Tutor`;
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const created = !description;
    const previousContent = description?.content ?? null;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content =
      profile.headline ??
      `${profile.name} teaches ${profile.subjects.map((s) => s.name).join(", ")}.`;
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${window.location.origin}/t/${profile.slug}`;
    document.head.appendChild(canonical);
    return () => {
      document.title = previousTitle;
      if (created) description?.remove();
      else if (description && previousContent != null)
        description.content = previousContent;
      canonical.remove();
    };
  }, [profile]);
}

/**
 * Public tutor profile (`/t/:slug`) — served from the marketing site so
 * profiles live on the root domain (SEO + shareable URLs). One layout for
 * everyone; content and density come from the tutor's own data.
 */
export default function PublicTutorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicTutorProfileResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!slug) return;
    setStatus("loading");
    getPublicProfile(slug)
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useProfileMeta(profile);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-border">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-2 px-5 py-4 sm:px-6 lg:px-9">
          <a href="/" aria-label="Clastor — home">
            <Logo />
          </a>
          <a
            href="/tutors"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
          >
            Browse tutors
          </a>
        </div>
      </header>

      <main className="flex-1">
        {status === "loading" && (
          <div className="mx-auto max-w-[1080px] px-5 py-12 sm:px-6 lg:px-9" aria-busy="true">
            <div className="grid animate-pulse gap-6 sm:grid-cols-[220px_1fr]">
              <div className="aspect-[4/5] max-w-[220px] rounded-3xl bg-muted" />
              <div className="space-y-3 py-6">
                <div className="h-10 w-56 rounded bg-muted" />
                <div className="h-5 w-72 rounded bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
              </div>
            </div>
          </div>
        )}

        {status === "missing" && (
          <div className="mx-auto max-w-md px-5 py-24 text-center">
            <p className="eyebrow">404</p>
            <h1 className="mt-4 font-display text-4xl leading-tight">
              Profile not available
            </h1>
            <p className="mt-2 text-muted-foreground">
              This tutor's page doesn't exist or hasn't been published yet.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button asChild variant="outline">
                <a href="/tutors">Browse tutors</a>
              </Button>
              <Button asChild variant="brand">
                <a href={APP_URL}>Go to Clastor</a>
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && profile && (
          <TutorProfileLayout profile={profile}>
            {slug && <ReviewsSection slug={slug} />}
          </TutorProfileLayout>
        )}
      </main>

      <footer className="border-t-2 border-border">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-1 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            This page was made with{" "}
            <a
              href="/"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Clastor
            </a>
            .
          </p>
          <p className="text-xs text-muted-foreground/70">
            Free scheduling, invoicing and student management for tutors.
          </p>
        </div>
      </footer>
    </div>
  );
}
