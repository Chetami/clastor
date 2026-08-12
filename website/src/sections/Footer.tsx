import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { APP_URL, NAV_LINKS } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t-2 border-border px-5 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="max-w-[34ch]">
            <Logo />
            <p className="mt-3.5 text-base leading-relaxed text-muted-foreground">
              Tutor management for independent professionals and small teams.
              Scheduling, reminders, and invoicing — connected.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              ...NAV_LINKS,
              { label: "Pricing", href: APP_URL },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { label: "About", href: APP_URL },
              { label: "Contact", href: APP_URL },
              { label: "Blog", href: APP_URL },
              { label: "Careers", href: APP_URL },
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              { label: "Help & FAQ", href: "/#faq" },
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Status", href: APP_URL },
            ]}
          />
        </div>

        <div className="mt-11 flex flex-col items-start justify-between gap-3 border-t-2 border-dashed border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>© {year} Clastor. Made for tutors, not agencies.</span>
          <span>Works with Google Calendar · Meet · Stripe</span>
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
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => {
          const isInternal = link.href.startsWith("/privacy") || link.href.startsWith("/terms");
          return (
            <li key={link.label}>
              {isInternal ? (
                <Link
                  to={link.href}
                  className="text-base text-foreground transition-colors hover:text-brand"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  href={link.href}
                  className="text-base text-foreground transition-colors hover:text-brand"
                >
                  {link.label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
