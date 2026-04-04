import type { JobRow } from "@/lib/jobs/queries";

export interface ClientJob
  extends Omit<
    JobRow,
    | "error_message"
    | "audio_storage_path"
    | "transcript_storage_path"
    | "draft_storage_path"
  > {
  errorCode: string | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasDraft: boolean;
}

export function serializeJobForClient(job: JobRow): ClientJob {
  const {
    error_message,
    audio_storage_path,
    transcript_storage_path,
    draft_storage_path,
    ...safe
  } = job;

  return {
    ...safe,
    errorCode: error_message ?? null,
    hasAudio: !!audio_storage_path,
    hasTranscript: !!transcript_storage_path,
    hasDraft: !!draft_storage_path,
  };
}
