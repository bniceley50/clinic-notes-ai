"use client";

import { useMemo, useState } from "react";

type SupportedNoteType = "soap" | "dap" | "birp";

type NoteViewerProps = {
  noteType: string;
  sessionDate: string;
  patientLabel: string;
  providerName: string;
  content?: string;
};

type Section = {
  heading: string;
  body: string;
};

const NOTE_SECTIONS: Record<SupportedNoteType, Section[]> = {
  soap: [
    {
      heading: "SUBJECTIVE",
      body:
        "Patient reports ongoing symptoms and clinical concerns discussed during the session. Review any direct quotes or subjective observations before finalizing.",
    },
    {
      heading: "OBJECTIVE",
      body:
        "Observed affect, participation level, and other clinical observations are summarized here using sanitized details for Milestone 0.",
    },
    {
      heading: "ASSESSMENT",
      body:
        "Clinical assessment should reflect provider judgment after review. AI-generated draft remains pending clinician confirmation.",
    },
    {
      heading: "PLAN",
      body:
        "Document follow-up actions, scheduling, interventions, and care plan updates after clinician review and sign-off.",
    },
  ],
  dap: [
    {
      heading: "DATA",
      body:
        "Encounter data, discussed themes, and notable session content summarized from the draft workflow.",
    },
    {
      heading: "ASSESSMENT",
      body:
        "Provider should verify symptom interpretation, risk review, and response to interventions before export.",
    },
    {
      heading: "PLAN",
      body:
        "Capture next actions, referrals, homework, or scheduling needs in this section.",
    },
  ],
  birp: [
    {
      heading: "BEHAVIOR",
      body:
        "Behavioral presentation, mood, participation, and other relevant observations from the session are summarized here.",
    },
    {
      heading: "INTERVENTION",
      body:
        "List interventions, counseling methods, psychoeducation, or treatment actions delivered during the session.",
    },
    {
      heading: "RESPONSE",
      body:
        "Document patient response to the interventions and any relevant change over baseline.",
    },
    {
      heading: "PLAN",
      body:
        "Outline follow-up tasks, next appointment timing, and any required provider review actions.",
    },
  ],
};

function getSupportedType(noteType: string): SupportedNoteType {
  if (noteType === "dap" || noteType === "birp") {
    return noteType;
  }

  return "soap";
}

export function NoteViewer({
  noteType,
  sessionDate,
  patientLabel,
  providerName,
  content,
}: NoteViewerProps) {
  const [copied, setCopied] = useState(false);
  const supportedType = getSupportedType(noteType);

  const copyOutput = useMemo(() => {
    const header = [
      `NOTE TYPE — ${sessionDate}`,
      `PATIENT LABEL: ${patientLabel}`,
      `PROVIDER: ${providerName}`,
      "SOURCE: CLINIC NOTES AI | AI-GENERATED — REVIEW REQUIRED",
      "",
    ];

    const sections = content
      ? [content]
      : NOTE_SECTIONS[supportedType].map(
          (section) => `${section.heading}\n${section.body}`,
        );

    return [...header, ...sections].join("\n");
  }, [content, patientLabel, providerName, sessionDate, supportedType]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyOutput);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="ql-panel ql-note-shell">
      <div className="ql-copy-row">
        <div>
          <p className="ql-kicker">Documentation</p>
          <h2 className="ql-panel-title">Clinical Note</h2>
        </div>
        <button type="button" className="ql-button-secondary" onClick={handleCopy}>
          {copied ? "Copied" : "Copy Note"}
        </button>
      </div>

      <div className="ql-alert ql-alert-warning">
        AI-GENERATED - REVIEW REQUIRED. Confirm all details before copying into
        the official medical record.
      </div>

      <div className="ql-note-header">
        <div>NOTE TYPE — {sessionDate}</div>
        <div>PATIENT LABEL: {patientLabel}</div>
        <div>PROVIDER: {providerName}</div>
        <div>SOURCE: CLINIC NOTES AI | AI-GENERATED — REVIEW REQUIRED</div>
      </div>

      {content ? (
        <pre
          className="ql-note-copy"
          style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
        >
          {content}
        </pre>
      ) : (
        <div className="ql-note-copy">
          {NOTE_SECTIONS[supportedType].map((section) => (
            <div className="ql-note-section" key={section.heading}>
              <div className="ql-section-title">{section.heading}</div>
              <div>{section.body}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
