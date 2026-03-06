"use client";

import type { ReactNode } from "react";
import { buildNoteHeaderLines } from "@/lib/clinical/note-format";

type NoteViewerProps = {
  noteType: string;
  sessionDate: string;
  patientLabel: string;
  providerName: string;
  content?: string;
  actions?: ReactNode;
};

export function NoteViewer({
  noteType,
  sessionDate,
  patientLabel,
  providerName,
  content,
  actions,
}: NoteViewerProps) {
  const headerLines = buildNoteHeaderLines({
    noteType,
    dateLabel: sessionDate,
    patientLabel,
    providerName,
  });

  return (
    <section className="ql-panel ql-note-shell">
      <div className="ql-copy-row">
        <div>
          <p className="ql-kicker">Documentation</p>
          <h2 className="ql-panel-title">Clinical Note</h2>
        </div>
        {actions ?? null}
      </div>

      <div className="ql-alert ql-alert-warning">
        AI-GENERATED - REVIEW REQUIRED. Confirm all details before copying into
        the official medical record.
      </div>

      <div className="ql-note-header">
        {headerLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      <pre
        className="ql-note-copy"
        style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
      >
        {content?.trim() || "No note content available."}
      </pre>
    </section>
  );
}
