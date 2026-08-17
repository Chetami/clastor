/**
 * Terms of Service page.
 *
 * Mirrors the layout and styling of the Privacy Policy page. Drafted for
 * Clastor (a tutor management platform). The legal wording should be reviewed
 * by a qualified professional before reliance — this is a starting point.
 */
export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      <article className="mx-auto max-w-4xl">
        <div className="mb-12">
          <p className="eyebrow">Legal</p>
          <h1 className="mb-4 mt-4 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-tight">
            Terms of Service
          </h1>
          <p className="text-lg text-muted-foreground">
            Last Updated: 17 August 2026
          </p>
        </div>

        <div className="max-w-none space-y-8">
          <section>
            <p className="leading-relaxed text-muted-foreground">
              Welcome to Clastor. These Terms of Service (&quot;Terms&quot;)
              govern your access to and use of the Clastor website, platform,
              mobile applications, and related services (collectively, the
              &quot;Services&quot;), which are provided by Clastor. Any
              reference to &quot;Clastor,&quot; &quot;we,&quot;
              &quot;us,&quot; &quot;our&quot; or the &quot;Company&quot; is a
              reference to Clastor. By creating an account, accessing, or using
              our Services, you agree to be bound by these Terms. If you do not
              agree to these Terms, you must not access or use our Services.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              If you access or use the Services on behalf of a school,
              institution, or other organisation, you represent and warrant that
              you have the authority to bind that organisation to these Terms,
              and in that case &quot;you&quot; refers to both you and that
              organisation.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">1. The Services</h2>
            <p className="leading-relaxed text-muted-foreground">
              Clastor is a tutor management platform that helps independent
              tutors and tutoring businesses manage the administrative side of
              their work. The Services include tools for managing students,
              scheduling lessons, creating and sending invoices, processing
              payments, and integrating with third-party tools such as Google
              Calendar and payment providers. We may add, change, or remove
              features from time to time at our discretion.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              These Terms, together with our Privacy Policy and any other
              applicable policies or agreements, form the entire agreement
              between you and Clastor regarding your use of the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">2. Accounts &amp; Eligibility</h2>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                You must be at least 18 years of age (or the age of legal
                majority in your jurisdiction) to create an account and use the
                Services.
              </li>
              <li>
                You agree to provide accurate, current, and complete information
                when creating your account and to keep it up to date.
              </li>
              <li>
                You are responsible for maintaining the security and
                confidentiality of your login credentials and for all activity
                that occurs under your account. You must notify us immediately
                of any unauthorised use or security breach.
              </li>
              <li>
                You may not transfer your account to another party without our
                prior written consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              3. Plans, Fees &amp; Billing
            </h2>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Some Services are offered on a paid subscription basis. The
                applicable fees, billing cycle, and plan features are displayed
                at the time you subscribe.
              </li>
              <li>
                Payments are processed through our third-party payment provider,
                Stripe. Your use of Stripe is also subject to Stripe&apos;s terms
                and policies.
              </li>
              <li>
                Subscriptions generally renew automatically at the end of each
                billing cycle until you cancel. You may cancel at any time;
                cancellation takes effect at the end of your current billing
                period.
              </li>
              <li>
                You are responsible for all applicable taxes. Unless required by
                law, fees are non-refundable, and we do not provide credits or
                refunds for partial billing periods.
              </li>
              <li>
                We may change our fees with reasonable notice. Any change will
                take effect at the start of your next billing cycle following
                the notice.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">4. Acceptable Use</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              You agree not to, and not to allow any third party to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Use the Services for any unlawful, fraudulent, or improper
                purpose, or in violation of any applicable law or these Terms;
              </li>
              <li>
                Infringe the intellectual property, privacy, or other rights of
                any person, including your students or clients;
              </li>
              <li>
                Upload or transmit viruses, malware, or any harmful code, or
                attempt to gain unauthorised access to, disrupt, or overload the
                Services;
              </li>
              <li>
                Reverse engineer, decompile, disassemble, or otherwise attempt
                to derive the source code of the Services, except as permitted
                by law;
              </li>
              <li>
                Scrape, crawl, or use automated means to extract data from the
                Services, or resell or redistribute access to the Services
                without our consent; or
              </li>
              <li>
                Use the Services in a manner that breaches the terms of any
                third-party integration, including Google and Stripe.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              5. Your Content &amp; Data Ownership
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              You retain ownership of all content and data you submit to the
              Services, including student records, lesson notes, invoices, and
              exam materials (&quot;Your Content&quot;). You grant Clastor a
              worldwide, non-exclusive licence to host, store, transmit, display
              and process Your Content solely as necessary to provide and
              improve the Services for you.
            </p>
            <div className="border-l-4 border-primary bg-primary/10 p-4 my-6">
              <p className="text-sm font-medium">
                Data Ownership: All data you provide or upload to our platform
                remains your property. We act solely as a processor of this
                information to provide you with our services. We may use
                AI-assisted features to help deliver the Services, but we do
                not use your data — including your content, student records,
                and lesson notes — to train artificial intelligence models or
                for any purpose not directly related to delivering the
                Services to you.
              </p>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              You are solely responsible for Your Content and for ensuring you
              have all necessary rights and consents — including under applicable
              privacy laws — to submit it to the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              6. Clastor&apos;s Intellectual Property
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              The Services, including the Clastor name and logo, software,
              design, text, graphics, and underlying technology, are owned by
              Clastor and are protected by intellectual property laws. These
              Terms grant you a limited, non-exclusive, non-transferable,
              revocable licence to access and use the Services for your own
              business purposes, subject to your compliance with these Terms.
              You must not copy, modify, distribute, or create derivative works
              of the Services without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">7. Third-Party Services</h2>
            <p className="leading-relaxed text-muted-foreground">
              The Services integrate with third-party tools and services such
              as Google Calendar, Stripe, PostHog (product analytics,
              including session recordings), artificial intelligence providers
              used to deliver AI-assisted features, and cloud infrastructure
              providers. Your use of those third-party services is subject to
              their own terms and policies, and Clastor is not responsible for
              their availability, conduct, or handling of your data. We may
              modify or remove third-party integrations at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">8. Disclaimers</h2>
            <p className="leading-relaxed text-muted-foreground">
              The Services are provided on an &quot;as is&quot; and
              &quot;as available&quot; basis. To the maximum extent permitted by
              law, Clastor excludes all warranties, representations, and
              conditions, whether express or implied, including any warranties of
              merchantability, fitness for a particular purpose, or
              non-infringement. We do not warrant that the Services will be
              uninterrupted, secure, error-free, or that any integration will
              function without interruption.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              9. Limitation of Liability
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              To the maximum extent permitted by law, in no event will Clastor be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, data, business, or
              goodwill, arising out of or related to your use of, or inability to
              use, the Services. Our total aggregate liability for any claim
              arising out of or relating to these Terms or the Services is
              limited to the amount you have paid us in the twelve (12) months
              preceding the claim, or fifty Australian dollars (AUD $50),
              whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">10. Indemnification</h2>
            <p className="leading-relaxed text-muted-foreground">
              You agree to indemnify and hold Clastor harmless from and against
              any claims, damages, losses, and expenses (including reasonable
              legal fees) arising out of or relating to Your Content, your breach
              of these Terms, your violation of applicable law or the rights of
              any third party, or your use of the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              11. Suspension &amp; Termination
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              We may suspend or restrict access to the Services immediately and
              without notice if we reasonably believe you have breached these
              Terms or pose a risk to the Services or other users. You may stop
              using the Services and cancel your account at any time. Upon
              termination, your right to use the Services ends, and we may delete
              Your Content in accordance with our retention practices and
              applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">
              12. Changes to These Terms
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              We may update these Terms from time to time. We will post the
              revised Terms on this page and update the &quot;Last Updated&quot;
              date. Where we make material changes, we will provide notice
              through the Services or by other reasonable means. By continuing to
              use the Services after changes take effect, you agree to be bound
              by the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">13. Governing Law</h2>
            <p className="leading-relaxed text-muted-foreground">
              These Terms are governed by and construed in accordance with the
              laws of Australia, without regard to its conflict of laws
              principles. You and Clastor submit to the exclusive jurisdiction of
              the courts of Australia in respect of any dispute arising out of
              or relating to these Terms or the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl">14. How to Contact Us</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              If you have any questions, concerns, or notices regarding these
              Terms or the Services, please contact us:
            </p>
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="mb-2 text-muted-foreground">
                <strong>Clastor</strong>
                <br />
                Attention: Legal
              </p>
              <p className="mb-4 text-muted-foreground">
                Email:{" "}
                <a
                  href="mailto:info@xamify.com.au"
                  className="text-primary hover:underline"
                >
                  info@xamify.com.au
                </a>
              </p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
