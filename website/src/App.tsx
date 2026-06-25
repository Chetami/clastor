import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "@/sections/Navbar";
import { Hero } from "@/sections/Hero";
import { Features } from "@/sections/Features";
import { HowItWorks } from "@/sections/HowItWorks";
import { WhyClastor } from "@/sections/WhyClastor";
import { FinalCTA } from "@/sections/FinalCTA";
import { Footer } from "@/sections/Footer";
import PrivacyPage from "@/pages/Privacy";
import TermsPage from "@/pages/Terms";

function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <WhyClastor />
      <FinalCTA />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
