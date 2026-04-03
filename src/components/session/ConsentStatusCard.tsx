"use client";

import { useState } from "react";
import { ConsentPrompt } from "@/components/jobs/ConsentPrompt";

type Props = {
  sessionId: string;
  initialHasConsent: boolean;
  initialConsentLabel: string;
  initialConsentTimestamp: string | null;
};

export function ConsentStatusCard({
  sessionId,
  initialHasConsent,
  initialConsentLabel,
  initialConsentTimestamp,
}: Props) {
  const [hasConsent, setHasConsent] = useState(initialHasConsent);
  const [consentLabel, setConsentLabel] = useState(initialConsentLabel);
  const [consentTimestamp, setConsentTimestamp] = useState(initialConsentTimestamp);

  function handleConsented() {
    const now = new Date().toISOString();
    setHasConsent(true);
    setConsentLabel("Consent recorded");
    setConsentTimestamp(now);
    window.location.reload();
  }

  const consentTextClass = hasConsent ? "text-[#2F6F44]" : "text-[#8A4B08]";

  return (
    <div className="space-y-4">
      <div className="card-ql overflow-hidden">
        <div className="border-b border-border-subtle bg-nav-bg px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent">
          Consent Status
        </div>
        <div className={`p-3 text-xs ${consentTextClass}`}>
          <p className="font-semibold">{consentLabel}</p>
          <p
            className={`mt-1 ${consentTextClass}`}
            suppressHydrationWarning
          >
            {hasConsent && consentTimestamp
              ? `Recorded ${new Date(consentTimestamp).toLocaleString()}`
              : "Record patient consent before starting a job."}
          </p>
        </div>
      </div>

      {!hasConsent && (
        <ConsentPrompt sessionId={sessionId} onConsented={handleConsented} />
      )}
    </div>
  );
}
