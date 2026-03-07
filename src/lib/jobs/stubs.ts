import "server-only";

import type { JobNoteType } from "./queries";

type TranscriptSeed = {
  patientLabel: string;
  providerName: string;
  sessionType: string;
};

const TRANSCRIPT_BLOCKS = [
  {
    timestamp: "[00:00:12]",
    speaker: "Provider",
    line: (seed: TranscriptSeed) =>
      `Good morning, ${seed.patientLabel}. I reviewed the follow-up items from your last ${seed.sessionType} visit, and I want to hear how the past week has gone before we make any changes.`,
  },
  {
    timestamp: "[00:00:49]",
    speaker: "Patient",
    line: () =>
      "I have been more consistent with sleep and hydration, and that seems to be helping. I still notice tension in the afternoons when work gets busy, but it is not lasting as long as it was before.",
  },
  {
    timestamp: "[00:01:31]",
    speaker: "Provider",
    line: () =>
      "That is helpful progress. We talked again about identifying the earliest physical signs of stress, using the breathing reset sooner, and keeping the evening routine steady on weekdays instead of waiting until symptoms escalate.",
  },
  {
    timestamp: "[00:02:18]",
    speaker: "Patient",
    line: () =>
      "The breathing exercise feels more natural now, and I used it twice before a meeting this week. I also wrote down the triggers we discussed, which made it easier to notice patterns instead of feeling caught off guard.",
  },
  {
    timestamp: "[00:03:04]",
    speaker: "Provider",
    line: (seed: TranscriptSeed) =>
      `We agreed to keep the current plan in place, continue tracking symptoms in a short daily note, and revisit intensity, sleep quality, and functional impact at the next appointment with ${seed.providerName}.`,
  },
];

type NoteTemplate = Record<
  string,
  {
    heading: string;
    body: (seed: TranscriptSeed) => string;
  }[]
>;

const NOTE_TEMPLATES: NoteTemplate = {
  soap: [
    {
      heading: "SUBJECTIVE",
      body: (seed) =>
        `${seed.patientLabel} reported improved sleep consistency and better use of coping strategies over the past week. The patient described afternoon stress at work that still occurs but resolves faster than baseline.`,
    },
    {
      heading: "OBJECTIVE",
      body: () =>
        "Patient was engaged, oriented, and able to reflect on recent triggers with clear detail. Speech was organized, affect was stable, and participation remained steady throughout the encounter.",
    },
    {
      heading: "ASSESSMENT",
      body: () =>
        "Clinical presentation suggests partial improvement in symptom management with early intervention skills. Residual stress reactivity remains present, but overall functioning appears more stable than at the prior visit.",
    },
    {
      heading: "PLAN",
      body: (seed) =>
        `Continue current coping plan, maintain a short symptom log, and reinforce early breathing resets before high-stress tasks. Reassess sleep quality, trigger patterns, and functional impact at the next follow-up ${seed.sessionType} visit.`,
    },
  ],
  dap: [
    {
      heading: "DATA",
      body: (seed) =>
        `${seed.patientLabel} described fewer prolonged stress episodes, more regular sleep, and improved awareness of daily triggers. The session reviewed work-related stressors, use of breathing exercises, and consistency with self-monitoring.`,
    },
    {
      heading: "ASSESSMENT",
      body: () =>
        "Patient is demonstrating growing insight and improved response to previously discussed interventions. Symptoms remain present but appear less disruptive, with no new acute concerns raised during the visit.",
    },
    {
      heading: "PLAN",
      body: () =>
        "Continue practicing early grounding strategies, maintain the tracking log, and review adherence and symptom burden at the next visit. Reinforce routines that support sleep stability and lower end-of-day stress.",
    },
  ],
  birp: [
    {
      heading: "BEHAVIOR",
      body: (seed) =>
        `${seed.patientLabel} presented as attentive, cooperative, and reflective when discussing recent stress patterns. The patient reported improvement in symptom duration and a stronger sense of control during work-related stress.`,
    },
    {
      heading: "INTERVENTION",
      body: () =>
        "Reviewed coping sequence, reinforced early breathing reset use, and discussed tracking triggers in a brief structured note. Provided supportive coaching around applying skills before stress escalates.",
    },
    {
      heading: "RESPONSE",
      body: () =>
        "Patient was receptive to the intervention, offered specific examples of using the strategy in real situations, and expressed confidence in continuing the current routine between visits.",
    },
    {
      heading: "PLAN",
      body: () =>
        "Maintain symptom tracking, continue skill practice during anticipated stress periods, and follow up on frequency, intensity, and recovery time at the next session.",
    },
  ],
  girp: [
    {
      heading: "GOAL",
      body: () =>
        "Support continued reduction in stress-related symptom burden and strengthen early use of coping tools during high-demand periods.",
    },
    {
      heading: "INTERVENTION",
      body: () =>
        "Reviewed trigger awareness, breathing reset timing, and structure for short daily symptom notes.",
    },
    {
      heading: "RESPONSE",
      body: () =>
        "Patient reported that the coping routine felt easier to initiate this week and described improved recovery after stressful tasks.",
    },
    {
      heading: "PLAN",
      body: () =>
        "Continue the current routine and review progress, symptom trends, and barriers at the next follow-up.",
    },
  ],
  intake: [
    {
      heading: "PRESENTING CONCERN",
      body: () =>
        "Patient described ongoing stress symptoms affecting routine functioning, with recent improvement after starting structured coping steps.",
    },
    {
      heading: "HISTORY",
      body: () =>
        "Relevant recent symptom course, work-related triggers, and current self-management strategies were reviewed in sanitized form for Milestone A testing.",
    },
    {
      heading: "ASSESSMENT",
      body: () =>
        "Initial impression supports continued outpatient follow-up with monitoring of symptom burden, sleep, and coping adherence.",
    },
    {
      heading: "PLAN",
      body: () =>
        "Establish ongoing follow-up, continue baseline tracking, and revisit symptom patterns and functional impact after another week of data.",
    },
  ],
  progress: [
    {
      heading: "PROGRESS",
      body: () =>
        "Patient reported measurable improvement in symptom recovery time and increased confidence using the current coping plan.",
    },
    {
      heading: "INTERVENTIONS REVIEWED",
      body: () =>
        "Session focused on reinforcement of early breathing resets, trigger tracking, and routine stabilization.",
    },
    {
      heading: "CLINICAL IMPRESSION",
      body: () =>
        "Current interventions appear beneficial, with ongoing monitoring needed to confirm stability over time.",
    },
    {
      heading: "NEXT STEPS",
      body: () =>
        "Continue the current plan and reassess symptom trends, sleep, and daily functioning at the next follow-up.",
    },
  ],
};

function resolveSupportedNoteType(noteType: JobNoteType): JobNoteType {
  if (NOTE_TEMPLATES[noteType]) {
    return noteType;
  }

  return "soap";
}

export function buildStubTranscript(seed: TranscriptSeed): string {
  return TRANSCRIPT_BLOCKS.map(
    (block) => `${block.timestamp} ${block.speaker}: ${block.line(seed)}`,
  ).join("\n\n");
}

export function buildStubNote(
  noteType: JobNoteType,
  seed: TranscriptSeed,
): string {
  const supported = resolveSupportedNoteType(noteType);
  const sections = NOTE_TEMPLATES[supported];

  return sections
    .map((section) => `${section.heading}:\n${section.body(seed)}`)
    .join("\n\n");
}
