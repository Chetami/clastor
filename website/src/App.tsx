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

const TITLES: Record<string, string> = {
  "/": "Clastor — Tutor management software for private tutors",
  "/privacy": "Privacy Policy - Clastor",
  "/terms": "Terms of Service - Clastor",
  "/contact": "Contact Clastor",
};

/** Resets scroll position and document title on every route change. */
function RouteManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = TITLES[pathname] ?? "Clastor";
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

export default function App() {
  return (
    <BrowserRouter>
      <RouteManager />
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
