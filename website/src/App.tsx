import { Navbar } from "@/sections/Navbar";
import { Hero } from "@/sections/Hero";
import { Features } from "@/sections/Features";
import { HowItWorks } from "@/sections/HowItWorks";
import { WhyClastor } from "@/sections/WhyClastor";
import { FinalCTA } from "@/sections/FinalCTA";
import { Footer } from "@/sections/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <WhyClastor />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
