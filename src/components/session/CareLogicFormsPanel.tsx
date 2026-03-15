"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  jobId: string;
  sessionType: string;
};

type FetchState = {
  loading: boolean;
  error: string | null;
  fields: Record<string, string> | null;
};

type FieldDefinition = {
  key: string;
  label: string;
};

type SectionDefinition = {
  title: string;
  fields: FieldDefinition[];
};

const INTAKE_SECTIONS: SectionDefinition[] = [
  {
    title: "Presenting Problem",
    fields: [
      {
        key: "presenting_problem",
        label:
          "Response to: Why does the client present for treatment, what type of treatment are they seeking, what are their goals and expectations, describe the client's problem in their own words including how long it has persisted and prior attempts to resolve it",
      },
    ],
  },
  {
    title: "Psychosocial History",
    fields: [
      {
        key: "psychosocial_narrative",
        label:
          "Narrative about marital status, living situation, community connections, support systems, cultural considerations, legal involvement, military status, school/work history",
      },
      {
        key: "legal_involvement",
        label: "Past and/or current legal involvement",
      },
    ],
  },
  {
    title: "Medical & Mental Health History",
    fields: [
      {
        key: "mental_health_history",
        label:
          "Family history of mental health symptoms and client's own history of mental health symptoms and treatment",
      },
      {
        key: "medical_history",
        label:
          "Current medical problems, stability, past medications and why discontinued, current medications with dosage",
      },
    ],
  },
  {
    title: "Strengths, Needs, Abilities, Preferences & Goals",
    fields: [
      {
        key: "strengths",
        label: "Client's strengths that will help in treatment",
      },
      {
        key: "needs",
        label: "What the client wants to learn in treatment",
      },
      {
        key: "abilities",
        label:
          "Client's personal qualities, skills, or talents that will help in treatment",
      },
      {
        key: "preferences",
        label:
          "What the client hopes to get out of treatment including treatment-related goals",
      },
      {
        key: "goals",
        label: "Client's overall treatment goals in their own words",
      },
    ],
  },
  {
    title: "Social Determinants",
    fields: [
      {
        key: "social_determinants_comments",
        label: "Any identified social determinants of health concerns",
      },
    ],
  },
  {
    title: "Safe Plan",
    fields: [
      {
        key: "safe_plan_most_important",
        label:
          "The one thing most important to the client and worth living for",
      },
      {
        key: "safe_plan_warning_signs",
        label: "Warning signs that a crisis may be developing",
      },
      {
        key: "safe_plan_coping_strategies",
        label: "Internal coping strategies",
      },
      {
        key: "safe_plan_social_distractions",
        label: "People and social settings that provide distraction",
      },
      {
        key: "safe_plan_support_people",
        label: "Family or friends who can ask for help",
      },
      {
        key: "safe_plan_means_restriction",
        label: "Means restriction and making the environment safe",
      },
    ],
  },
  {
    title: "Harm to Others",
    fields: [
      {
        key: "harm_to_others_comments",
        label:
          "Any thoughts about harming or killing others, history of assault",
      },
    ],
  },
];

const SESSION_SECTIONS: SectionDefinition[] = [
  {
    title: "Individual Session Documentation",
    fields: [
      {
        key: "client_perspective",
        label:
          "Document client's perspective in their own words on current problems, issues, needs, and progress",
      },
      {
        key: "current_status_interventions",
        label:
          "Document client's current status, assessed needs, and interventions used during this session. Present the provision of services in an understandable manner.",
      },
      {
        key: "response_to_interventions",
        label:
          "Describe the client's response to interventions. Include what steps need to be taken and/or completed by the next scheduled session.",
      },
      {
        key: "since_last_visit",
        label:
          "Have new issues presented or significant changes occurred in the client's life since last visit? Provide specific details including any lethality assessment or safety plan completion.",
      },
    ],
  },
  {
    title: "Goals",
    fields: [
      {
        key: "goals_addressed",
        label: "Which treatment goals were addressed during this session",
      },
    ],
  },
  {
    title: "Additional",
    fields: [
      {
        key: "interactive_complexity",
        label:
          "Document why interactive complexity applies to this visit per CPT guidelines if applicable",
      },
      {
        key: "coordination_of_care",
        label: "Details on coordination of care with other providers if applicable",
      },
    ],
  },
  {
    title: "Mental Status Exam",
    fields: [
      {
        key: "mse_summary",
        label:
          "Mental status exam summary and clinical conclusions based on clinician observations during session",
      },
    ],
  },
];

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
        AI-generated - review and edit before pasting into your EHR
      </p>
    </div>
  );
}

export function CareLogicFormsPanel({ jobId, sessionType }: Props) {
  const [state, setState] = useState<FetchState>({
    loading: true,
    error: null,
    fields: null,
  });

  const sections = useMemo(
    () => (sessionType === "intake" ? INTAKE_SECTIONS : SESSION_SECTIONS),
    [sessionType],
  );

  async function loadFields() {
    setState({ loading: true, error: null, fields: null });

    try {
      const response = await fetch(`/api/jobs/${jobId}/carelogic-fields`);
      const payload = (await response.json().catch(() => null)) as
        | { fields?: Record<string, string>; error?: string }
        | null;

      if (!response.ok || !payload?.fields) {
        setState({
          loading: false,
          error: "Failed to load EHR fields",
          fields: null,
        });
        return;
      }

      setState({ loading: false, error: null, fields: payload.fields });
    } catch {
      setState({
        loading: false,
        error: "Failed to load EHR fields",
        fields: null,
      });
    }
  }

  useEffect(() => {
    void loadFields();
  }, [jobId]);

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
        <div className="flex items-center gap-2 text-sm" style={{ color: "#746EB1" }}>
          <span
            className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#746EB1", borderTopColor: "transparent" }}
          />
          Loading EHR fields...
        </div>
      </div>
    );
  }

  if (state.error || !state.fields) {
    return (
      <div className="ql-panel" data-testid="carelogic-forms-panel-error">
        <p className="ql-alert ql-alert-error" role="alert">
          {state.error ?? "Failed to load EHR fields"}
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
