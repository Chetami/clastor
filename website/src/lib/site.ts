/** The production app that all "Try Clastor Free" CTAs point to. */
export const APP_URL = "https://app.clastor.xamify.com.au";

export const BRAND_NAME = "Clastor";

// Absolute hashes (e.g. "/#features") so the links resolve to the root page's
// sections from any route — otherwise they'd point to e.g. /privacy#features.
export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For teams", href: "/#for-teams" },
  { label: "FAQ", href: "/#faq" },
] as const;
