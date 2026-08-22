import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Navbar } from "@/sections/Navbar";
import { Hero } from "@/sections/Hero";
import { Integrations } from "@/sections/Integrations";
import { Features } from "@/sections/Features";
import { HowItWorks } from "@/sections/HowItWorks";
import { Audience } from "@/sections/Audience";
import { ForPrivateTutors } from "@/sections/ForPrivateTutors";
// import { Proof } from "@/sections/Proof";
import { FAQ } from "@/sections/FAQ";
import { FinalCTA } from "@/sections/FinalCTA";
import { Footer } from "@/sections/Footer";
import { APP_URL } from "@/lib/site";
import PrivacyPage from "@/pages/Privacy";
import TermsPage from "@/pages/Terms";
import ContactPage from "@/pages/Contact";
import TutorsDirectoryPage from "@/pages/TutorsDirectory";
import PublicTutorPage from "@/pages/PublicTutor";

const TITLES: Record<string, string> = {
  "/": "Clastor — Tutor management software for private tutors",
  "/privacy": "Privacy Policy - Clastor",
  "/terms": "Terms of Service - Clastor",
  "/contact": "Contact Clastor",
  "/tutors": "Find a tutor — Clastor Tutor Directory",
};

/** Resets scroll position and document title on every route change. */
function RouteManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // /t/:slug pages manage their own document.title (tutor name) — don't
    // clobber it here (parent effects run after child effects).
    if (!pathname.startsWith("/t/")) {
      document.title = TITLES[pathname] ?? "Clastor";
    }
  }, [pathname]);

  return null;
}

function Landing() {
  return (
    <>
      <Hero />
      <Integrations />
      <HowItWorks />
      <ForPrivateTutors />
      <Features />
      <Audience />
      {/* <Proof /> */}
      <FAQ />
      <FinalCTA />
    </>
  );
}

function NotFound() {
  return (
    <section className="mx-auto max-w-[640px] px-5 py-32 text-center sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-display text-[clamp(2.5rem,7vw,4rem)] leading-tight">
        We can&apos;t find that page.
      </h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-lg text-muted-foreground">
        The link may be broken or the page may have moved. Try the homepage, or
        jump straight into Clastor.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-4">
        <a
          href="/"
          className="inline-flex h-12 items-center rounded-full border-[2.5px] border-foreground bg-card px-8 text-lg shadow-sketch transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sketch-lg"
        >
          Back to home
        </a>
        <a
          href={APP_URL}
          className="inline-flex h-12 items-center rounded-full border-[2.5px] border-foreground bg-brand px-8 text-lg shadow-sketch transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sketch-lg"
        >
          Join the beta
        </a>
      </div>
    </section>
  );
}

/**
 * Skips the marketing navbar/footer on individual tutor profile pages —
 * those are the tutor's own pages and carry their own minimal chrome
 * (brand mark + browse link + "made with Clastor" footer).
 */
function SiteChrome({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isTutorProfile = pathname.startsWith("/t/");
  return (
    <div className="min-h-screen bg-background">
      {!isTutorProfile && <Navbar />}
      <main>{children}</main>
      {!isTutorProfile && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteManager />
      <SiteChrome>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/tutors" element={<TutorsDirectoryPage />} />
          <Route path="/t/:slug" element={<PublicTutorPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SiteChrome>
    </BrowserRouter>
  );
}
