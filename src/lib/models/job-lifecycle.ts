export type JobStage = "queued" | "transcribing" | "complete" | "failed";

export type AdvancedJobStage = "drafting" | "exporting";

export type AnyJobStage = JobStage | AdvancedJobStage;

export interface JobState {
  stage: AnyJobStage;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasNote: boolean;
  isComplete: boolean;
  isFailed: boolean;
  isProcessing: boolean;
}

type DeriveJobStateInput = {
  stage: string;
  status: string;
  audio_storage_path?: string | null;
};

type JobStateOverrides = {
  hasTranscript?: boolean;
  hasNote?: boolean;
};

function normalizeStage(stage: string, status: string): AnyJobStage {
  if (
    stage === "queued" ||
    stage === "transcribing" ||
    stage === "drafting" ||
    stage === "exporting" ||
    stage === "complete" ||
    stage === "failed"
  ) {
    return stage;
  }

  if (status === "failed") return "failed";
  if (status === "complete") return "complete";
  return "queued";
}

export function deriveJobState(
  job: DeriveJobStateInput,
  overrides: JobStateOverrides = {},
): JobState {
  const stage = normalizeStage(job.stage, job.status);
  const derivedHasTranscript =
    stage === "complete" || stage === "drafting" || stage === "exporting";

  return {
    stage,
    hasAudio: !!job.audio_storage_path,
    hasTranscript: overrides.hasTranscript ?? derivedHasTranscript,
    hasNote: overrides.hasNote ?? false,
    isComplete: job.status === "complete",
    isFailed: job.status === "failed" || stage === "failed",
    isProcessing:
      stage === "transcribing" || stage === "drafting" || stage === "exporting",
  };
}

export function shouldShowTranscript(state: JobState): boolean {
  return state.hasTranscript;
}

export function shouldShowEhrFields(state: JobState): boolean {
  return state.hasTranscript;
}

export function shouldShowAdvancedSection(state: JobState): boolean {
  return state.hasTranscript;
}

export function shouldShowAudioPlayer(state: JobState): boolean {
  return state.hasAudio;
}

export function shouldShowJobProgress(state: JobState): boolean {
  return state.isProcessing;
}
