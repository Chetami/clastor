import { useEffect } from "react";
import { PUBLIC_SITE_URL } from "@/config/site";

/**
 * Client-side redirect to the public marketing site, which owns the public
 * tutor pages in production (/t/:slug, /tutors). Only mounted when
 * VITE_PUBLIC_SITE_URL is configured — local dev renders the app's own
 * public pages instead.
 */
export function PublicSiteRedirect() {
  useEffect(() => {
    window.location.replace(
      PUBLIC_SITE_URL +
        window.location.pathname +
        window.location.search +
        window.location.hash,
    );
  }, []);

  return (
    <div className="flex min-h-[50dvh] items-center justify-center px-4">
      <p className="text-muted-foreground">
        This page has moved to{" "}
        <a
          href={PUBLIC_SITE_URL + window.location.pathname}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {PUBLIC_SITE_URL}
        </a>
        .
      </p>
    </div>
  );
}
