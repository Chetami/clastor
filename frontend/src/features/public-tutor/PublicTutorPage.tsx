import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/features/auth/BrandMark";
import { getPublicProfileRequest } from "./api/requests";
import { getTemplate } from "./templates/registry";

export default function PublicTutorPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-tutor", slug],
    queryFn: () => getPublicProfileRequest(slug!),
    enabled: !!slug,
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <BrandMark size={28} />
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
          <Link
            to="/login"
            className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-foreground"
          >
            Go to Clastor
          </Link>
        </div>
      )}

      {!isLoading && profile && (() => {
        const Template = getTemplate(profile.template);
        return <Template profile={profile} />;
      })()}
    </div>
  );
}
