"use client";

import React, { useMemo, useState } from "react";
import { useCareLogicFields } from "@/hooks/useCareLogicFields";
import {
  INTAKE_SECTIONS,
  SESSION_SECTIONS,
} from "@/components/session/ehr-fields-config";

type Props = {
  jobId: string;
  sessionType: string;
};

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const [editedValue, setEditedValue] = useState(value);

  async function handleCopy() {
    await navigator.clipboard.writeText(editedValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        border: "1px solid #E7E9EC",
        borderRadius: 2,
        padding: 12,
        backgroundColor: "#FFFFFF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <p
          className="text-xs font-semibold"
          style={{ color: "#3B276A", margin: 0 }}
        >
          {label}
        </p>
        <button
          type="button"
          className="ql-button-secondary"
          style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <textarea
        value={editedValue}
        onChange={(e) => setEditedValue(e.target.value)}
        style={{
          width: "100%",
          minHeight: 112,
          border: "1px solid #D7DADF",
          borderRadius: 2,
          padding: 10,
          font: "inherit",
          lineHeight: "16px",
          resize: "vertical",
          backgroundColor: "#FFFFFF",
          color: "#333333",
        }}
      />
      <p style={{ fontSize: 10, color: "#999999", marginTop: 4, marginBottom: 0 }}>
        AI-generated from the session transcript. Review and edit before entering into the EHR.
      </p>
    </div>
  );
}

export function CareLogicFormsPanel({ jobId, sessionType }: Props) {
  const sections = useMemo(
    () => (sessionType === "intake" ? INTAKE_SECTIONS : SESSION_SECTIONS),
    [sessionType],
  );
  const {
    state,
    generatedAt,
    regenError,
    isRegenerating,
    loadFields,
    regenerate,
  } = useCareLogicFields(jobId);

  if (!jobId) {
    return (
      <div className="ql-panel">
        <p className="ql-alert ql-alert-warning">
          EHR field extraction is unavailable until transcription has completed for this session.
        </p>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="ql-panel" data-testid="carelogic-forms-panel-loading">
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span
            className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#746EB1", borderTopColor: "transparent" }}
          />
          Extracting EHR-ready fields...
        </div>
      </div>
    );
  }

  if (!state.fields) {
    return (
      <div className="ql-panel" data-testid="carelogic-forms-panel-error">
        <p className="ql-alert ql-alert-error" role="alert">
          {state.error ?? "Unable to load structured fields from this transcript."}
        </p>
        <button
          type="button"
          className="ql-button-secondary"
          onClick={() => void loadFields()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ql-grid" data-testid="carelogic-forms-panel">
      <section className="ql-panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: 12,
            borderBottom: "1px solid #E7E9EC",
          }}
        >
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#517AB7", margin: 0 }}
            >
              Structured fields
            </p>
            {generatedAt ? (
              <p
                className="text-xs"
                style={{ color: "#666666", marginTop: 6, marginBottom: 0 }}
              >
                Generated {generatedAt}
              </p>
            ) : null}
          </div>
          {state.fields ? (
            <button
              type="button"
              className="ql-button-secondary"
              onClick={() => void regenerate()}
              disabled={isRegenerating}
            >
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </button>
          ) : null}
        </div>
        {regenError ? (
          <p
            className="ql-alert ql-alert-error"
            role="alert"
            style={{ margin: 12 }}
          >
            {regenError}
          </p>
        ) : null}
      </section>
      {sections.map((section) => (
        <section key={section.title} className="ql-panel">
          <div
            className="border-b px-4 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ borderColor: "#E7E9EC", color: "#517AB7", backgroundColor: "#F9F9F9" }}
          >
            {section.title}
          </div>
          <div style={{ display: "grid", gap: 12, padding: 12 }}>
            {section.fields.map((field) => (
              <FieldRow
                key={field.key}
                label={field.label}
                value={state.fields?.[field.key] ?? "[Insufficient information in transcript]"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
