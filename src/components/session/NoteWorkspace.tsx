"use client";

import { useMemo, useState } from "react";
import { buildEhrCopyText, buildDocxFilename } from "@/lib/clinical/note-format";
import { CareLogicFormsPanel as EhrFieldsPanel } from "./CareLogicFormsPanel";
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

function noteTabClass(isActive: boolean): string {
  return [
    "rounded-[2px] border border-primary px-[14px] py-[6px] text-xs font-semibold",
    isActive ? "bg-primary text-white" : "bg-white text-primary",
  ].join(" ");
}

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
  const [activeTab, setActiveTab] = useState<"draft" | "ehrFields">("draft");
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
      buildEhrCopyText({
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={noteTabClass(activeTab === "draft")}
              onClick={() => setActiveTab("draft")}
              data-testid="note-tab-draft"
            >
              AI Draft
            </button>
            <button
              type="button"
              className={noteTabClass(activeTab === "ehrFields")}
              onClick={() => setActiveTab("ehrFields")}
              data-testid="note-tab-ehr-fields"
            >
              EHR Fields
            </button>
          </div>
        </div>

        <div className={activeTab === "draft" ? "block" : "hidden"}>
            <div className="ql-copy-row mt-3">
              <div>
                <p className="ql-kicker">Draft Controls</p>
                <h2 className="ql-panel-title">Edit and Export</h2>
              </div>
              <div className="flex flex-wrap gap-2">
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
              className="mt-[10px] flex flex-wrap gap-3 text-[11px] text-text-muted"
            >
              <span data-testid="note-save-state">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
              <span>Last saved: {new Date(lastSavedAt).toLocaleString()}</span>
            </div>

            {error ? (
              <p className="ql-alert ql-alert-error mt-2" role="alert">
                {error}
              </p>
            ) : null}

            {mode === "edit" ? (
              <div className="mt-3">
                <label className="ql-label" htmlFor="note-editor">
                  Note Content
                </label>
                <textarea
                  id="note-editor"
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  data-testid="note-editor"
                  className="min-h-[320px] w-full resize-y rounded-[2px] border border-border-subtle bg-white p-[10px] leading-4 text-text-body [font:inherit]"
                />
              </div>
            ) : (
              <p className="ql-subtitle mt-3">
                Previewing the current note content. Switch to edit mode to revise the
                draft before copying or export.
              </p>
            )}
        </div>

        <div className={`${activeTab === "ehrFields" ? "block" : "hidden"} mt-3`}>
          <EhrFieldsPanel jobId={jobId} sessionType={sessionType} />
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
