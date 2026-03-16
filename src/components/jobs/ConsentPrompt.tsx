"use client";

import { ConsentGate } from "./ConsentGate";
import { NOT_RECORDED_CONSENT_STATUS } from "@/lib/models/consent";

type Props = {
  sessionId: string;
  onConsented: () => void;
};

export function ConsentPrompt({ sessionId, onConsented }: Props) {
  return (
    <div className="card-ql overflow-hidden">
      <div
        className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
        style={{
          backgroundColor: "#F9F9F9",
          borderColor: "#E7E9EC",
          color: "#517AB7",
        }}
      >
        Record Consent
      </div>
      <div className="p-3">
        <p className="text-xs" style={{ color: "#333333" }}>
          Before recording, confirm that the patient has verbally consented to
          AI-assisted documentation. Audio will be processed by OpenAI
          (transcription) and Anthropic (EHR field extraction).
        </p>
        <ConsentGate
          sessionId={sessionId}
          consentStatus={NOT_RECORDED_CONSENT_STATUS}
          onConfirmed={onConsented}
          onDeclined={() => {
            // Keep the prompt visible; ConsentGate already handles the declined UI.
          }}
        />
      </div>
    </div>
  );
}
