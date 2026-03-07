"use client";

import { useState } from "react";

// ── Section definitions per note type ────────────────────────
const NOTE_SECTIONS: Record<string, string[]> = {
  soap:     ["Subjective", "Objective", "Assessment", "Plan"],
  dap:      ["Data", "Assessment", "Plan"],
  birp:     ["Behavior", "Intervention", "Response", "Plan"],
  girp:     ["Goal", "Intervention", "Response", "Plan"],
  intake:   ["Presenting Problem", "History", "Mental Status", "Assessment", "Plan"],
  progress: ["Session Summary", "Interventions", "Progress", "Plan"],
};

type NoteSection = { heading: string; body: string };

// ── Parse raw note text into sections ────────────────────────
function parseNoteSections(content: string, noteType: string): NoteSection[] {
  const sectionNames = NOTE_SECTIONS[noteType.toLowerCase()] ?? [];

  if (!content.trim()) return [];

  // No known sections for this type — show as single block
  if (sectionNames.length === 0) {
    return [{ heading: noteType.toUpperCase(), body: content.trim() }];
  }

  // Build regex: matches "SectionName:" or "SECTIONNAME:" at start of line
  const escapedNames = sectionNames.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `^(${escapedNames.join("|")}):?\\s*$`,
    "gim",
  );

  const sections: NoteSection[] = [];
  let lastHeading: string | null = null;
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (lastHeading !== null) {
      sections.push({
        heading: lastHeading,
        body: content.slice(lastIndex, match.index).trim(),
      });
    }
    lastHeading = match[1];
    lastIndex = match.index + match[0].length;
  }

  if (lastHeading !== null) {
    sections.push({
      heading: lastHeading,
      body: content.slice(lastIndex).trim(),
    });
  }

  // Fallback: content has no recognizable headers — show as single block
  if (sections.length === 0) {
    return [{ heading: noteType.toUpperCase(), body: content.trim() }];
  }

  return sections;
}

// ── Format structured output for CareLogic paste ─────────────
function formatForCareLogic(
  sections: NoteSection[],
  noteType: string,
  sessionDate: string,
  patientLabel: string,
  providerName: string,
): string {
  const typeLabel = noteType.toUpperCase();
  const divider = "─".repeat(60);

  const header = [
    `${typeLabel} NOTE — ${sessionDate}`,
    `Patient: ${patientLabel}`,
    `Provider: ${providerName}`,
    `Source: Clinic Notes AI  |  AI-GENERATED — REVIEW REQUIRED`,
    divider,
    "",
  ].join("\n");

  const body = sections
    .map((s) => `${s.heading.toUpperCase()}:\n${s.body}`)
    .join("\n\n");

  return header + body;
}

// ── Props ─────────────────────────────────────────────────────
export type NoteViewerProps = {
  content: string;
  noteType: string;
  sessionDate: string;
  patientLabel: string;
  providerName: string;
  reviewed?: boolean;
};

export function NoteViewer({
  content,
  noteType,
  sessionDate,
  patientLabel,
  providerName,
  reviewed = false,
}: NoteViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const sections = parseNoteSections(content, noteType);
  const hasContent = sections.length > 0 && sections.some((s) => s.body);

  const handleCopy = async () => {
    if (!reviewed) setShowWarning(true);

    const text = hasContent
      ? formatForCareLogic(sections, noteType, sessionDate, patientLabel, providerName)
      : "";

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="card-ql" data-testid="clinical-note-viewer">

      {/* ── Header bar ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#E7E9EC", backgroundColor: "#F9F9F9" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "#517AB7" }}
          >
            {noteType.toUpperCase()} Note
          </span>

          <span
            className="rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider chip-queued"
          >
            AI Draft
          </span>

          {reviewed && (
            <span
              className="rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider chip-complete"
            >
              Reviewed
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasContent}
          className="btn-ql flex items-center gap-1.5 text-xs py-1"
          title="Copy formatted note for pasting into CareLogic"
        >
          {copied ? "✓ Copied!" : "⎘ Copy for CareLogic"}
        </button>
      </div>

      {/* ── Unreviewed warning ──────────────────────────── */}
      {showWarning && !reviewed && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs font-medium"
          style={{
            backgroundColor: "#FFF8E7",
            borderBottom: "1px solid #CCCCB4",
            color: "#3B276A",
          }}
        >
          <span>
            ⚠ Copied before review. Verify all content in CareLogic before signing.
          </span>
          <button
            type="button"
            onClick={() => setShowWarning(false)}
            className="ml-4 font-bold text-sm leading-none"
            aria-label="Dismiss"
            style={{ color: "#3B276A" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Note body — sectioned ───────────────────────── */}
      {hasContent ? (
        <div className="divide-y" style={{ borderColor: "#E7E9EC" }} data-testid="clinical-note-content">
          {sections.map((section) => (
            <div key={section.heading}>
              {/* Section header strip */}
              <div
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: "#EEF2FF", color: "#517AB7" }}
              >
                {section.heading}
              </div>
              {/* Section body */}
              <div className="px-4 py-3">
                <pre
                  className="whitespace-pre-wrap text-sm leading-relaxed m-0"
                  style={{
                    fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
                    color: "#333333",
                  }}
                >
                  {section.body || (
                    <span style={{ color: "#777777", fontStyle: "italic" }}>
                      (empty)
                    </span>
                  )}
                </pre>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm" style={{ color: "#777777" }}>
          <p>No note content yet.</p>
          <p className="mt-1 text-xs">Start a job above to generate a draft.</p>
        </div>
      )}

      {/* ── Footer watermark ────────────────────────────── */}
      <div
        className="border-t px-4 py-2 text-[10px]"
        style={{ borderColor: "#E7E9EC", color: "#777777" }}
      >
        AI-GENERATED — REVIEW REQUIRED before pasting into CareLogic.
        Clinician signature constitutes acceptance of content.
      </div>
    </div>
  );
}
