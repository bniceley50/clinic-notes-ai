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

  return (
    <div className="space-y-4">
      <div className="card-ql overflow-hidden">
        <div
          className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
          style={{
            backgroundColor: "#F9F9F9",
            borderColor: "#E7E9EC",
            color: "#517AB7",
          }}
        >
          Consent Status
        </div>
        <div className="p-3 text-xs" style={{ color: hasConsent ? "#2F6F44" : "#8A4B08" }}>
          <p className="font-semibold">{consentLabel}</p>
          <p
            className="mt-1"
            suppressHydrationWarning
            style={{ color: hasConsent ? "#2F6F44" : "#8A4B08" }}
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