import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-nav-bg">
      <div
        className="flex items-center px-4"
        style={{ height: "32px", backgroundColor: "#3B276A", color: "#ffffff" }}
      >
        <Link href="/login" className="text-xs font-semibold tracking-wide no-underline text-white">
          Clinic Notes AI
        </Link>
      </div>

      <main className="flex-1 px-6 py-8 mx-auto w-full max-w-2xl">
        <h1 className="text-base font-bold uppercase tracking-wider mb-1 text-accent">
          Privacy Policy
        </h1>
        <p className="text-[11px] mb-6 text-text-muted">
          Last updated: March 24, 2026
        </p>

        <div className="card-ql p-6 space-y-5 text-sm text-text-body">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              1. Who We Are
            </h2>
            <p>
              Clinic Notes AI is operated by Niceley AI Consulting LLC (&ldquo;we&rdquo;,
              &ldquo;us&rdquo;, &ldquo;our&rdquo;), a Kentucky limited liability company.
              This Privacy Policy describes how we collect, use, and protect information when
              you use the Clinic Notes AI service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              2. Information We Collect
            </h2>
            <p>
              <strong>Account information:</strong> Email address and display name provided
              during invitation and account setup.
            </p>
            <p className="mt-2">
              <strong>Audio recordings:</strong> Session audio uploaded by clinicians for
              transcription. Audio is processed by OpenAI Whisper for transcription and is
              stored temporarily in encrypted storage.
            </p>
            <p className="mt-2">
              <strong>Clinical content:</strong> Transcriptions, extracted EHR fields, and
              generated note drafts produced during use of the Service. This content is
              stored in your practice&rsquo;s isolated database partition.
            </p>
            <p className="mt-2">
              <strong>Usage data:</strong> Authentication events, job processing events, and
              error logs. These logs do not contain clinical content or patient information.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              3. How We Use Information
            </h2>
            <p>
              We use collected information solely to provide and improve the Service. Specifically:
              to authenticate users, to process audio into transcriptions and structured fields,
              to generate clinical note drafts, to monitor service health, and to diagnose errors.
              We do not sell, rent, or share your information with third parties for marketing
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              4. Third-Party Services
            </h2>
            <p>
              The Service uses the following third-party providers to process data:
            </p>
            <p className="mt-2">
              <strong>OpenAI</strong> &mdash; Audio transcription via the Whisper API. Audio
              data is transmitted to OpenAI for processing and is subject to their data usage
              policies.
            </p>
            <p className="mt-2">
              <strong>Anthropic</strong> &mdash; AI-powered field extraction and note generation
              via the Claude API. Transcript text is transmitted to Anthropic for processing.
            </p>
            <p className="mt-2">
              <strong>Supabase</strong> &mdash; Database, authentication, and file storage
              infrastructure.
            </p>
            <p className="mt-2">
              <strong>Vercel</strong> &mdash; Application hosting and deployment.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              5. Data Isolation and Security
            </h2>
            <p>
              All clinical data is isolated by practice using row-level security policies
              enforced at the database level. Users can only access data belonging to their
              own practice. Data is encrypted in transit (TLS) and at rest. Audit logs track
              access and processing events without recording clinical content.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              6. Data Retention
            </h2>
            <p>
              Session data (transcriptions, extracted fields, notes) is retained until
              explicitly deleted by the user or practice administrator. Temporary processing
              artifacts (audio files, intermediate outputs) may be purged after processing
              is complete.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              7. Your Rights
            </h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by
              contacting us. Practice administrators can delete sessions and associated data
              directly within the application.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              8. HIPAA Notice
            </h2>
            <p>
              Clinic Notes AI is designed with HIPAA-adjacent security controls. Business
              Associate Agreements (BAAs) with third-party vendors are required before any
              protected health information (PHI) is processed through the Service. Until BAAs
              are in place, the Service should be used only with de-identified or synthetic
              data.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify active users
              of material changes. Continued use of the Service constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-accent">
              10. Contact
            </h2>
            <p>
              For privacy-related questions or data requests, contact us at{" "}
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
