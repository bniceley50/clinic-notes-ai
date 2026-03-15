"use client";

import { useMemo, useState } from "react";
import { buildCareLogicCopyText, buildDocxFilename } from "@/lib/clinical/note-format";
import { CareLogicFormsPanel } from "./CareLogicFormsPanel";
import { NoteViewer } from "./NoteViewer";

type Props = {
  sessionId: string;
  noteId: string;
  noteType: string;
  jobId: string;
  sessionType: string;
  sessionCreatedAt: string;
  sessionDate: string;
  patientLabel: string;
  providerName: string;
  initialContent: string;
  initialUpdatedAt: string;
};

type SavePayload = {
  note: {
    id: string;
    content: string;
    updated_at: string;
    note_type: string;
  };
};

export function NoteWorkspace({
  sessionId,
  noteId,
  noteType,
  jobId,
  sessionType,
  sessionCreatedAt,
  sessionDate,
  patientLabel,
  providerName,
  initialContent,
  initialUpdatedAt,
}: Props) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [activeTab, setActiveTab] = useState<"draft" | "carelogic">("draft");
  const [draftContent, setDraftContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [lastSavedAt, setLastSavedAt] = useState(initialUpdatedAt);
  const [pendingSave, setPendingSave] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draftContent !== savedContent;

  const copyOutput = useMemo(
    () =>
      buildCareLogicCopyText({
        noteType,
        dateLabel: sessionDate,
        patientLabel,
        providerName,
        content: draftContent,
      }),
    [draftContent, noteType, patientLabel, providerName, sessionDate],
  );

  async function saveContent(nextContent = draftContent): Promise<boolean> {
    setPendingSave(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/notes/${noteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: nextContent,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | SavePayload
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("note" in payload)) {
        setError(
          (payload && "error" in payload && payload.error) ||
            "Failed to save note",
        );
        return false;
      }

      setDraftContent(payload.note.content);
      setSavedContent(payload.note.content);
      setLastSavedAt(payload.note.updated_at);
      return true;
    } finally {
      setPendingSave(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(copyOutput);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      if (dirty) {
        const saved = await saveContent(draftContent);
        if (!saved) {
          return;
        }
      }

      const response = await fetch(`/api/sessions/${sessionId}/notes/${noteId}/export`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Failed to export note");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildDocxFilename(
        sessionType,
        new Date(sessionCreatedAt),
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="ql-grid">
      <section className="ql-panel" data-testid="note-workspace">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={activeTab === "draft"
                ? {
                    backgroundColor: "#3B276A",
                    color: "#FFFFFF",
                    border: "1px solid #3B276A",
                    borderRadius: 2,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }
                : {
                    backgroundColor: "#FFFFFF",
                    color: "#3B276A",
                    border: "1px solid #3B276A",
                    borderRadius: 2,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
              onClick={() => setActiveTab("draft")}
              data-testid="note-tab-draft"
            >
              AI Draft
            </button>
            <button
              type="button"
              style={activeTab === "carelogic"
                ? {
                    backgroundColor: "#3B276A",
                    color: "#FFFFFF",
                    border: "1px solid #3B276A",
                    borderRadius: 2,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }
                : {
                    backgroundColor: "#FFFFFF",
                    color: "#3B276A",
                    border: "1px solid #3B276A",
                    borderRadius: 2,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
              onClick={() => setActiveTab("carelogic")}
              data-testid="note-tab-carelogic"
            >
              EHR Fields
            </button>
          </div>
        </div>

        <div style={{ display: activeTab === "draft" ? "block" : "none" }}>
            <div className="ql-copy-row" style={{ marginTop: 12 }}>
              <div>
                <p className="ql-kicker">Draft Controls</p>
                <h2 className="ql-panel-title">Edit and Export</h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ql-button-secondary"
                  onClick={() =>
                    setMode((current) =>
                      current === "preview" ? "edit" : "preview",
                    )
                  }
                  data-testid="edit-note-button"
                >
                  {mode === "preview" ? "Edit Note" : "Preview Note"}
                </button>
                <button
                  type="button"
                  className="ql-button"
                  disabled={!dirty || pendingSave}
                  onClick={() => void saveContent()}
                  data-testid="save-note-button"
                >
                  {pendingSave ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="ql-button-secondary"
                  onClick={() => void handleCopy()}
                  data-testid="copy-note-button"
                >
                  {copyState === "copied" ? "Copied!" : "Copy for EHR"}
                </button>
                <button
                  type="button"
                  className="ql-button-secondary"
                  disabled={exporting}
                  onClick={() => void handleExport()}
                  data-testid="export-note-button"
                >
                  {exporting ? "Exporting..." : "Export .docx"}
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                color: "var(--ql-text-muted)",
                fontSize: 11,
              }}
            >
              <span data-testid="note-save-state">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <span>Last saved: {new Date(lastSavedAt).toLocaleString()}</span>
            </div>

            {error ? (
              <p className="ql-alert ql-alert-error" role="alert" style={{ marginTop: 8 }}>
                {error}
              </p>
            ) : null}

            {mode === "edit" ? (
              <div style={{ marginTop: 12 }}>
                <label className="ql-label" htmlFor="note-editor">
                  Note Content
                </label>
                <textarea
                  id="note-editor"
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  data-testid="note-editor"
                  style={{
                    width: "100%",
                    minHeight: 320,
                    border: "1px solid var(--ql-border)",
                    borderRadius: 2,
                    padding: 10,
                    font: "inherit",
                    lineHeight: "16px",
                    background: "#fff",
                    color: "var(--ql-text)",
                    resize: "vertical",
                  }}
                />
              </div>
            ) : (
              <p className="ql-subtitle" style={{ marginTop: 12 }}>
                Previewing the current note content. Switch to edit mode to revise the
                draft before copying or export.
              </p>
            )}
        </div>

        <div
          style={{
            display: activeTab === "carelogic" ? "block" : "none",
            marginTop: 12,
          }}
        >
          <CareLogicFormsPanel jobId={jobId} sessionType={sessionType} />
        </div>
      </section>

      {activeTab === "draft" ? (
        <NoteViewer
          noteType={noteType}
          sessionDate={sessionDate}
          patientLabel={patientLabel}
          providerName={providerName}
          content={draftContent}
        />
      ) : null}
    </div>
  );
}
