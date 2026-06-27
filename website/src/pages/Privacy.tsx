import { useEffect } from "react";

/**
 * Privacy Policy page.
 *
 * Clastor Vite SPA. The legal wording, branding, contact details and regulator
 * references are preserved verbatim — Clastor is a product of Clastor
 * (Clastor.com.au), which is the data controller this policy describes.
 */
export default function PrivacyPage() {
  // Mirrors the Next.js `metadata.title` export for this route.
  useEffect(() => {
    document.title = "Privacy Policy - Clastor";
  }, []);

  return (
    <div className="container mx-auto px-4 py-20">
      <article className="mx-auto max-w-4xl">
        <div className="mb-12">
          <h1 className="mb-4 text-5xl font-bold">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground">
            Last Updated: 18 April 2026
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8">
          <section>
            <p className="leading-relaxed text-muted-foreground">
              Your privacy is important to us and so is being transparent about
              how we collect, use, and share information about you. This Privacy
              Policy explains our privacy practices for the activities described
              herein. Please read this Privacy Policy carefully to learn how we
              collect, use, disclose, store, and handle your personal
              information when you access our website or use any of our
              Services. Any reference to &quot;Clastor,&quot; &quot;we,&quot;
              &quot;us,&quot; &quot;our&quot; or the &quot;Company&quot; is a
              reference to Clastor. When you access our Website or use our
              Services you agree to the terms of this Privacy Policy.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Sometimes we will need to update our Privacy Policy so it may
              change from time to time. By continuing to use our Website or
              Services after we make any changes, you will be deemed to have
              accepted those changes, so it is important that you read this
              Privacy Policy in its entirety and check this Privacy Policy
              regularly for any updates.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              What is personal information?
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              &apos;Personal information&apos; is information we collect and
              hold which is identifiable as being about you.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              This policy covers how we treat your information, including your
              personal information, that you provide when you access or use our
              services. Our services include Clastor, an AI-powered exam creation
              and grading platform for schools and teachers. We are not
              responsible for and our services don&apos;t extend to the services
              of any company we don&apos;t own or control, or people that we
              don&apos;t manage.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Types of information we collect
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We collect personal information directly only when you provide it
              to us. The types of personal information we collect includes but
              is not limited to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Identifying information such as name;</li>
              <li>Contact information such as email address and phone number;</li>
              <li>
                Professional information including qualifications and teaching
                curriculum;
              </li>
              <li>Institution or school information;</li>
              <li>Exam content and questions you create;</li>
              <li>Student performance data (if applicable);</li>
              <li>Usage data and analytics.</li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Any sensitive information you provide to us may be relevant to
              providing you with our services, and you acknowledge that we will
              use your sensitive information for this sole purpose. Your
              sensitive information will only be disclosed for another purpose
              where you would reasonably expect the sensitive information to be
              disclosed, and the disclosure is directly related to providing you
              with our services.
            </p>
            <div className="border-l-4 border-primary bg-primary/10 p-4 my-6">
              <p className="text-sm font-medium">
                Data Ownership: For users accessing our Services through a
                school, institution, or paid subscription, all data you provide
                or upload to our platform remains your property. We act solely
                as a processor of this information to provide you with our
                services.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Cloud-based Data Storage and Management
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We use secure cloud-based data storage solutions for managing
              files uploaded by users to our services. These documents are
              stored on secure cloud infrastructure which helps us organise data
              in a structured manner. Access to these documents is restricted to
              ensure that users can only access their own uploaded data.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Users have the capability to delete their data safely and
              completely. Our systems are designed to ensure data fetching is
              conducted securely, which enhances data retrieval processes and
              security. The AI systems involved in managing these documents
              process only the contents within the files necessary to provide
              our services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Ways of collecting information
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We have different ways of collecting information. We collect your
              personal information directly from you, including when you:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Access or use our Website;</li>
              <li>Subscribe to, purchase or use our Services;</li>
              <li>
                Use our Services as an authorised user (for example, as an
                employee of one of our customers who provided you with access to
                our services);
              </li>
              <li>
                Sign up to receive marketing material including exclusive
                offers, promotions, or events;
              </li>
              <li>
                Participate in surveys, competitions, promotions or request
                information or material from us;
              </li>
              <li>
                Make inquiries about us or our Services or otherwise communicate
                with us by email, by telephone, in person, via the Website or
                otherwise; and
              </li>
              <li>Apply to work with us or are engaged by us.</li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We may collect personal information about you which may be
              provided to us by a teacher or staff member working at a
              particular school to which we provide our Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              How do we use cookies and analytics?
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Certain information is collected automatically through your
              device, such as your computer address, computer type, operating
              system name and version, device manufacturer and model, language,
              Internet browser type and the websites you visit, including
              through cookies and analytics. We collect this information to
              analyse data, to track your experience on our Website and to
              improve the functionality and experience of Clastor products,
              services and our Website.
            </p>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We use the following technologies to collect technical information
              and general analytics:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Cookies</strong> – these are type of data files that are
                placed on your device and often include an anonymous unique
                identifier;
              </li>
              <li>
                <strong>Log files</strong>, which track actions occurring on our
                Website (which we collect anonymous data on and track); and
              </li>
              <li>
                <strong>Web beacons, tags, and pixels</strong>, which are
                electronic files used to record information about how you browse
                our Website.
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              By using our Website and our Services, you are consenting to the
              use of these technologies in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              How we use and disclose information
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              In general, we use your personal information for purposes or
              legitimate interests connected with our business. We use your
              personal information strictly for the purposes of providing our
              Services to you. Specifically:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                To enable the proper operation and functionality of our Services
                as requested by you or your organisation;
              </li>
              <li>To verify your identity when you access our Services;</li>
              <li>
                To communicate with you regarding our Services and to address any
                updates, issues or complaints;
              </li>
              <li>
                To consider you for a job at Clastor (whether as an employee or
                contractor) or other relationships with us;
              </li>
              <li>
                To meet our legal obligations related to providing our Services;
              </li>
              <li>
                To contact you regarding the above, including via electronic
                messaging such as email, by mail, by phone or in any other
                lawful manner.
              </li>
            </ul>
            <div className="border-l-4 border-primary bg-primary/10 p-4 my-6">
              <p className="text-sm font-medium">
                <strong>No Training on Your Data:</strong> For schools,
                institutions, and paid subscribers, we do not use your data for
                any purposes beyond what is necessary to provide you with our
                platform and services. We do not train any artificial
                intelligence models on institutional or paid-subscriber data,
                nor do we use it for any purposes not directly related to your
                use of our Services.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Who do we disclose personal information to?
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We may disclose your personal information to third parties in
              connection with the purposes described above. This may include
              disclosing your personal information to the following types of
              third parties:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Our professional advisers (such as lawyers, accountants or
                auditors) and insurers;
              </li>
              <li>
                Our employees, contractors and third party service providers who
                assist us in performing our functions and activities;
              </li>
              <li>Payment systems operators and financial institutions;</li>
              <li>Cloud service providers and data storage providers;</li>
              <li>
                Telecommunications providers and IT support services providers;
              </li>
              <li>
                Third parties to whom you have authorised us to disclose your
                information; and
              </li>
              <li>Any other person as required or permitted by law.</li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We may also share anonymous or de-identified usage data with our
              service providers for the purpose of helping us in such analysis
              and improvements. Additionally, we may share such anonymous or
              de-identified usage data on an aggregate basis in the normal
              course of operating our business.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">Data Security Practices</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We implement industry-standard security measures to protect your
              personal information:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Encryption:</strong> We use encryption in transit and at
                rest to protect your sensitive data;
              </li>
              <li>
                <strong>Access Controls:</strong> We maintain strict access
                controls and authentication systems;
              </li>
              <li>
                <strong>Regular Audits:</strong> We conduct regular security
                audits and assessments;
              </li>
              <li>
                <strong>Accredited Infrastructure:</strong> We use accredited
                data centers via Google Cloud Platform and Firebase;
              </li>
              <li>
                <strong>Incident Response:</strong> We have processes in place to
                detect and respond to security incidents.
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              While we have implemented appropriate organisational and technical
              measures, we cannot guarantee the security of transmission of
              personal information online. All personal information you share
              with us online is disclosed at your own risk. Please notify us
              immediately if you become aware of any breach of security.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              How long do we keep your personal information?
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              We will keep your personal information only for as long as
              necessary to provide you with our Services, unless a longer
              retention period is required by law or specified in our retention
              policy. When you request deletion of your data, we ensure it is
              deleted completely from our systems, except where retention is
              necessary to comply with legal obligations, resolve disputes, or
              maintain security.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Your rights in relation to information
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              You may seek access, correct or update personal information we hold
              about you by contacting us as described in the &quot;How to contact
              us&quot; section below. You may have the following rights:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Access:</strong> Request access to personal information
                we hold about you;
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate
                data;
              </li>
              <li>
                <strong>Deletion:</strong> Request erasure of personal
                information we hold about you;
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Withdraw consent where we
                relied on your consent to process your personal information;
              </li>
              <li>
                <strong>Restrict Processing:</strong> Request that we restrict
                our use of your personal information;
              </li>
              <li>
                <strong>Data Portability:</strong> Request a copy of your
                personal information in a structured, machine-readable format;
              </li>
              <li>
                <strong>Opt-out:</strong> Opt-out of marketing communications at
                any time.
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We may require that the person requesting access provide suitable
              identification and where permitted by law we may charge a fee for
              giving access to your personal information. These rights apply to
              the extent required under applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Data Ownership and AI Training
            </h2>
            <div className="border-l-4 border-primary bg-primary/10 p-4 my-6">
              <p className="mb-4 text-sm font-medium">
                <strong>
                  Institutional and Paid-Subscriber Data:
                </strong>
              </p>
              <p className="text-sm">
                Any school, educational institution, or organisation holding a
                paid subscription with Clastor retains full and exclusive
                ownership over all data submitted by or on behalf of that
                organisation and its students. This includes all exam content,
                student work, assessment data, and any other content uploaded or
                generated through the use of our Services. We will not use
                institutional or paid-subscriber data — including their
                students&apos; data — for model training, product development, or
                any purpose beyond delivering the Services to that organisation.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Compliance and Best Practices
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              We follow industry best practices and implement appropriate
              technical and organisational measures to protect your personal
              information. Our privacy and security practices are aligned with
              OWASP guidelines and industry standards. Our privacy practices are
              designed to align with the principles of:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Data Minimisation:</strong> We collect only the
                information necessary to provide our services;
              </li>
              <li>
                <strong>Transparency:</strong> We provide clear information about
                our data practices;
              </li>
              <li>
                <strong>User Control:</strong> We give you control over your
                personal information;
              </li>
              <li>
                <strong>Security by Design:</strong> We implement security
                measures from the ground up;
              </li>
              <li>
                <strong>Regular Review:</strong> We regularly review and update
                our privacy and security practices.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              How can you complain about a privacy issue?
            </h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              You may make a privacy complaint in relation to personal
              information we hold about you by contacting us as described in the
              &quot;How to contact us&quot; section below.
            </p>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              If you make a privacy complaint, our team will investigate the
              matter and attempt to resolve it as soon as reasonably possible
              (usually within 30 days of receipt of your complaint).
            </p>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              If you believe your concerns have not been resolved
              satisfactorily by us, or you wish to obtain more information on
              privacy requirements you can contact your regulatory authority.
              This may be:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                The Office of the Australian Information Commissioner on 1300 363
                992 or visit their website at{" "}
                <a
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.oaic.gov.au
                </a>
                ;
              </li>
              <li>
                Your local data protection authority:{" "}
                <a
                  href="https://edpb.europa.eu/about-edpb/board/members_en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  European Data Protection Board
                </a>
                ;
              </li>
              <li>
                The Office of the Privacy Commissioner (NZ):{" "}
                <a
                  href="https://www.privacy.org.nz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.privacy.org.nz
                </a>
                ; or
              </li>
              <li>
                The Office of the Privacy Commissioner (Canada):{" "}
                <a
                  href="https://www.priv.gc.ca/en/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.priv.gc.ca
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">How to contact us</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              If you have a query, concern or complaint about the manner in
              which your personal information has been collected or handled by us
              or would like to request access to or correction of the personal
              information we hold about you, please contact us:
            </p>
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="mb-2 text-muted-foreground">
                <strong>Clastor</strong>
                <br />
                Attention: Privacy Officer
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

          <section>
            <h2 className="mb-4 text-3xl font-bold">International Data Transfers</h2>
            <p className="leading-relaxed text-muted-foreground">
              We store personal information in secure data centers. Where we
              transfer personal information internationally, we take appropriate
              steps to ensure that overseas recipients that we disclose personal
              information to have adequate safeguards in place. This may include
              assessing the privacy laws in the country where the information is
              disclosed or putting in place contractual clauses with third party
              service providers regarding data handling practices.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-3xl font-bold">
              Changes to this Privacy Policy
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on this
              page and updating the &quot;Last Updated&quot; date. You are
              advised to review this Privacy Policy periodically for any
              changes. Changes to this Privacy Policy are effective when they
              are posted on this page.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
