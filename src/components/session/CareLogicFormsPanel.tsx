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
    <div className="rounded-[2px] border border-border-subtle bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="m-0 text-xs font-semibold text-primary">
          {label}
        </p>
        <button
          type="button"
          className="ql-button-secondary px-[10px] py-1 text-[11px]"
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <textarea
        value={editedValue}
        onChange={(e) => setEditedValue(e.target.value)}
        className="min-h-[112px] w-full resize-y rounded-[2px] border border-[#D7DADF] bg-white p-[10px] leading-4 text-[#333333] [font:inherit]"
      />
      <p className="mb-0 mt-1 text-[10px] text-[#999999]">
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
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
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
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle p-3">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-accent">
              Structured fields
            </p>
            {generatedAt ? (
              <p className="mb-0 mt-1.5 text-xs text-[#666666]">
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
          <p className="ql-alert ql-alert-error m-3" role="alert">
            {regenError}
          </p>
        ) : null}
      </section>
      {sections.map((section) => (
        <section key={section.title} className="ql-panel">
          <div className="border-b border-border-subtle bg-nav-bg px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            {section.title}
          </div>
          <div className="grid gap-3 p-3">
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
