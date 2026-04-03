import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-nav-bg">
      <div className="flex h-[32px] items-center bg-primary px-4 text-white">
        <Link href="/login" className="text-xs font-semibold tracking-wide no-underline text-white">
          Clinic Notes AI
        </Link>
      </div>

      <main className="flex-1 px-6 py-8 mx-auto w-full max-w-2xl">
        <h1 className="text-base font-bold uppercase tracking-wider mb-1 text-accent">
          Terms of Service
        </h1>
        <p className="text-[11px] mb-6 text-text-muted">
          Last updated: March 24, 2026
        </p>

        <div className="card-ql p-6 space-y-5 text-sm text-text-body">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Clinic Notes AI (&ldquo;the Service&rdquo;), operated by
              Niceley AI Consulting LLC (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;),
              you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              2. Description of Service
            </h2>
            <p>
              Clinic Notes AI is a clinical documentation tool that assists behavioral health
              clinicians with audio transcription, structured EHR field extraction, and optional
              note drafting. The Service is designed as a productivity aid and does not replace
              professional clinical judgment.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              3. Eligibility and Access
            </h2>
            <p>
              Access to the Service is by invitation only. You must be authorized by your
              practice administrator to use the Service. You are responsible for maintaining the
              confidentiality of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              4. Acceptable Use
            </h2>
            <p>
              You agree to use the Service only for its intended purpose of clinical
              documentation. You will not attempt to reverse-engineer, exploit, or misuse the
              Service. You are responsible for ensuring that your use complies with all
              applicable laws and professional regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              5. Clinical Responsibility
            </h2>
            <p>
              AI-generated transcriptions, field extractions, and note drafts are provided as
              suggestions only. You are solely responsible for reviewing, editing, and approving
              all clinical documentation before it is finalized or entered into any electronic
              health record system.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              6. Data and Privacy
            </h2>
            <p>
              We take data privacy seriously. Please review our{" "}
              <Link href="/privacy" className="text-accent">
                Privacy Policy
              </Link>{" "}
              for details on how we collect, use, and protect information processed through the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              7. Disclaimer of Warranties
            </h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, express or implied. We do not warrant that the Service will
              be uninterrupted, error-free, or that AI-generated outputs will be accurate or
              complete.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              8. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, Niceley AI Consulting LLC shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              9. Modifications
            </h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the revised Terms. We will notify active users
              of material changes.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              10. Contact
            </h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:brian@niceley.ai" className="text-accent">
                brian@niceley.ai
              </a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
