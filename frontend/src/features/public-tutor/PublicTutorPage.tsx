import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/features/auth/BrandMark";
import { isFeatureEnabled } from "@/config/features";
import { getPublicProfileRequest } from "./api/requests";
import { TutorProfileLayout } from "./TutorProfileLayout";
import { ReviewsSection } from "./ReviewsSection";

/** Keep the browser tab + link previews useful for a public profile. */
function useProfileMeta(
  name: string | undefined,
  headline: string | null | undefined,
) {
  useEffect(() => {
    if (!name) return;
    const previousTitle = document.title;
    document.title = `${name} | Clastor Tutor`;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousContent = meta?.content ?? null;
    if (headline && meta) meta.content = headline;
    else if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      meta.content = headline ?? `Book a lesson with ${name} on Clastor.`;
      document.head.appendChild(meta);
    }
    return () => {
      document.title = previousTitle;
      if (meta && previousContent != null) meta.content = previousContent;
    };
  }, [name, headline]);
}

export default function PublicTutorPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-tutor", slug],
    queryFn: () => getPublicProfileRequest(slug!),
    enabled: !!slug,
    retry: false,
  });

  useProfileMeta(profile?.name, profile?.headline);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4">
          <Link to="/tutors" aria-label="Clastor home" className="flex items-center gap-2">
            <BrandMark size={28} />
          </Link>
          {isFeatureEnabled("publicProfile") && (
            <Link
              to="/tutors"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Browse tutors
            </Link>
          )}
        </div>
      </header>

      {isLoading && (
        <div className="mx-auto max-w-3xl px-4 py-12" aria-busy="true">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="mt-10 space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && (isError || !profile) && (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Profile not available
          </h1>
          <p className="mt-2 text-muted-foreground">
            This tutor's page doesn't exist or hasn't been published yet.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            {isFeatureEnabled("publicProfile") && (
              <Link
                to="/tutors"
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                Browse tutors
              </Link>
            )}
            <Link
              to="/login"
              className="text-sm underline underline-offset-4 hover:text-foreground"
            >
              Go to Clastor
            </Link>
          </div>
        </div>
      )}

      {!isLoading && profile && (
        <>
          <TutorProfileLayout profile={profile}>
            {slug && <ReviewsSection slug={slug} />}
          </TutorProfileLayout>
          <footer className="border-t">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This page was made with{" "}
                <Link
                  to="/signup"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Clastor
                </Link>
                .
              </p>
              <p className="text-xs text-muted-foreground/70">
                Free scheduling, invoicing and student management for tutors.
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
