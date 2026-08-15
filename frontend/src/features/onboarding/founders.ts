export type Founder = {
  name: string;
  role: string;
  /**
   * Photo served from /founders/<slug>.jpg. Drop the real image into
   * `frontend/public/founders/` and it shows automatically (Radix Avatar
   * falls back to initials while the file is missing).
   */
  photo: string;
  initials: string;
  /**
   * Where the "contact us directly" button links. Use a `mailto:` address or
   * a Calendly/booking URL.
   */
  contactHref: string;
  contactLabel: string;
};

/**
 * Founders shown in onboarding. Photos live in `frontend/public/founders/`
 * and fall back to initials when missing.
 */
export const FOUNDERS: Founder[] = [
  {
    name: "Amritesh D",
    role: "Co-founder",
    photo: "/founders/amritesh.jpg",
    initials: "AD",
    contactHref: "mailto:amritesh@xamify.com.au",
    contactLabel: "Email Amritesh",
  },
  {
    name: "Chethin W",
    role: "Co-founder",
    photo: "/founders/chethin.jpg",
    initials: "CW",
    contactHref: "mailto:chethin@xamify.com.au",
    contactLabel: "Email Chethin",
  },
];
