import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { APP_URL, BRAND_NAME } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The all-in-one management platform that runs the business side of
              tutoring — so you can focus on teaching.
            </p>
          </div>

          <nav
            className="flex flex-wrap gap-x-8 gap-y-2"
            aria-label="Footer"
          >
            <a
              href="/#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="/#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="/#why-clastor"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Why Clastor
            </a>
            <a
              href={APP_URL}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </a>
            <Link
              to="/privacy"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            © {year} {BRAND_NAME}. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made for tutors, by educators.
          </p>
        </div>
      </div>
    </footer>
  );
}
