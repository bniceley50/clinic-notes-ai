export type EhrField = {
  key: string;
  label: string;
};

export type EhrSection = {
  title: string;
  fields: EhrField[];
};

export const INTAKE_SECTIONS: EhrSection[] = [
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

export const SESSION_SECTIONS: EhrSection[] = [
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
