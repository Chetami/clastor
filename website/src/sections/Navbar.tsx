import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { APP_URL, NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-150",
        scrolled
          ? "border-b-[2px] border-border bg-background/80 backdrop-blur-md backdrop-saturate-150"
          : "border-b-2 border-transparent bg-transparent",
      )}
    >
      <nav
        className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-6 lg:px-9"
        aria-label="Primary"
      >
        <a href="/" className="flex items-center gap-2.5" aria-label="Clastor — home">
          <Logo />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-lg text-muted-foreground transition-colors hover:text-brand"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/tutors"
            className="text-lg text-muted-foreground transition-colors hover:text-brand"
          >
            Find a tutor
          </a>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <a
            href={APP_URL}
            className="text-lg text-muted-foreground transition-colors hover:text-brand"
          >
            Sign in
          </a>
          <Button asChild variant="brand" size="sm">
            <a href={APP_URL}>Join the beta</a>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={cn("fixed inset-x-0 top-[72px] z-40 border-b-[2px] border-foreground bg-background px-4 shadow-sketch md:hidden", open ? "flex" : "hidden")}
      >
        <div className="flex w-full flex-col py-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b-2 border-dashed border-border py-3 text-lg text-foreground last:border-b-0 last:text-brand"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/tutors"
            onClick={() => setOpen(false)}
            className="border-b-2 border-dashed border-border py-3 text-lg text-foreground"
          >
            Find a tutor
          </a>
          <a
            href={APP_URL}
            onClick={() => setOpen(false)}
            className="mt-4 text-lg text-brand"
          >
            Join the beta →
          </a>
        </div>
      </div>
    </header>
  );
}
