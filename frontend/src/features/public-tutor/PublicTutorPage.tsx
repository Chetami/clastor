import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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
        <div className="flex items-center justify-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
