import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { APP_URL, BRAND_NAME } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The all-in-one platform that runs the business side of tutoring
              — so you can focus on teaching.
            </p>
          </div>

          {/* Product */}
          <FooterCol
            title="Product"
            links={[
              { label: "Features", href: "/#features" },
              { label: "How it works", href: "/#how-it-works" },
              { label: "For teams", href: "/#for-teams" },
              { label: "FAQ", href: "/#faq" },
            ]}
          />

          {/* Get started */}
          <FooterCol
            title="Get started"
            links={[
              { label: "Start free", href: APP_URL, external: true },
              { label: "Sign in", href: APP_URL, external: true },
            ]}
          />

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-foreground/80 transition-colors hover:text-brand"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-foreground/80 transition-colors hover:text-brand"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
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

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) =>
          link.external ? (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-sm text-foreground/80 transition-colors hover:text-brand"
              >
                {link.label}
              </a>
            </li>
          ) : (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-sm text-foreground/80 transition-colors hover:text-brand"
              >
                {link.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
