"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  onConfirmed: () => void;
  onDeclined: () => void;
};

export function ConsentGate({ sessionId, onConfirmed, onDeclined }: Props) {
  const [part2Applicable, setPart2Applicable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    setDeclined(false);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hipaa_consent: true,
          part2_applicable: part2Applicable,
          part2_consent: part2Applicable ? true : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record consent");
      }

      onConfirmed();
    } catch {
      setError("Unable to record consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeclined() {
    setDeclined(true);
    setError(null);
    onDeclined();
  }

  return (
    <div
      className="mt-3 p-4 space-y-4"
      style={{
        border: "1px solid #F2C078",
        borderRadius: "2px",
        backgroundColor: "#FFF6E8",
      }}
    >
      <p
        className="text-sm font-semibold"
        style={{ color: "#8A4B08" }}
      >
        Patient Consent Required
      </p>

      <p
        className="text-xs"
        style={{ color: "#8A4B08" }}
      >
        Before recording, confirm that the patient has verbally consented to
        AI-assisted documentation. Audio will be processed by OpenAI
        (transcription) and Anthropic (EHR field extraction and optional notes).
      </p>

      <label
        className="flex items-start gap-2 text-xs cursor-pointer"
        style={{ color: "#8A4B08" }}
      >
        <input
          type="checkbox"
          checked={part2Applicable}
          onChange={(event) => setPart2Applicable(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          This patient has a substance use disorder diagnosis
          (requires 42 CFR Part 2 consent)
        </span>
      </label>

      {part2Applicable && (
        <div
          className="p-3 text-xs space-y-1"
          style={{
            border: "1px solid #E5B25C",
            borderRadius: "2px",
            backgroundColor: "#FDEBC8",
            color: "#7A4308",
          }}
        >
          <p className="font-semibold">42 CFR Part 2 Disclosure</p>
          <p>
            The patient has been informed that their substance use disorder
            treatment records will be disclosed to the following for the purpose
            of AI-assisted clinical documentation:
          </p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>OpenAI - audio transcription</li>
            <li>Anthropic - EHR field extraction and optional note generation</li>
            <li>Supabase - encrypted storage</li>
            <li>Vercel - application hosting</li>
            <li>Upstash - session management</li>
          </ul>
          <p className="mt-1">
            The patient has provided explicit verbal consent for this disclosure.
          </p>
        </div>
      )}

      {error && (
        <p
          className="text-xs font-medium"
          style={{ color: "#CC2200" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {declined && (
        <p
          className="text-xs font-medium"
          style={{ color: "#CC2200" }}
          role="alert"
        >
          Consent declined. No job can be started for this session.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="flex-1 px-3 py-2 text-xs font-medium disabled:opacity-50"
          style={{
            backgroundColor: "#3B276A",
            color: "#FFFFFF",
            borderRadius: "2px",
          }}
        >
          {submitting ? "Recording consent..." : "Patient has consented - continue"}
        </button>

        <button
          type="button"
          onClick={handleDeclined}
          disabled={submitting}
          className="px-3 py-2 text-xs"
          style={{
            border: "1px solid #D7DADF",
            borderRadius: "2px",
            color: "#555555",
            backgroundColor: "#FFFFFF",
          }}
        >
          Patient declined
        </button>
      </div>
    </div>
  );
}
