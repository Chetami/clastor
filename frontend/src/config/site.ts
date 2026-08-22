/**
 * The public marketing site owns the public tutor pages (/t/:slug and
 * /tutors) so they're served from the root domain. In production the app
 * sets VITE_PUBLIC_SITE_URL and redirects those routes there; in local dev
 * (no value set) the app renders its own copies.
 */
export const PUBLIC_SITE_URL = (
  import.meta.env.VITE_PUBLIC_SITE_URL ?? ""
).replace(/\/+$/, "");

/** Absolute URL for a public-site path, falling back to this origin. */
export function publicSiteUrl(path: string): string {
  const base = PUBLIC_SITE_URL || window.location.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
