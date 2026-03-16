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
  isCancelled: boolean;
  isProcessing: boolean;
  isActive: boolean;
}

type DeriveJobStateInput = {
  stage: string;
  status: string;
  audio_storage_path?: string | null;
  transcript_storage_path?: string | null;
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
    !!job.transcript_storage_path ||
    stage === "complete" ||
    stage === "drafting" ||
    stage === "exporting";
  const isCancelled = job.status === "cancelled";
  const isProcessing =
    stage === "transcribing" || stage === "drafting" || stage === "exporting";
  const isComplete = job.status === "complete";
  const isFailed = job.status === "failed" || stage === "failed";

  return {
    stage,
    hasAudio: !!job.audio_storage_path,
    hasTranscript: overrides.hasTranscript ?? derivedHasTranscript,
    hasNote: overrides.hasNote ?? false,
    isComplete,
    isFailed,
    isCancelled,
    isProcessing,
    isActive: !isComplete && !isFailed && !isCancelled,
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

export function isJobActive(state: JobState): boolean {
  return state.isActive;
}

export function shouldAllowAudioUpload(state: JobState): boolean {
  return state.stage === "queued" && !state.hasAudio;
}

export function didJobReachComplete(
  previous: JobState | null,
  next: JobState,
): boolean {
  return !previous?.isComplete && next.isComplete;
}

export function getJobTitle(state: JobState): string {
  if (state.isComplete) return "Transcription complete";
  if (state.isCancelled) return "Transcription cancelled";
  if (state.isFailed) return "Transcription failed";
  if (state.isProcessing) {
    return state.stage === "transcribing"
      ? "Transcription in progress"
      : "Processing in progress";
  }
  return "Transcription queued";
}
