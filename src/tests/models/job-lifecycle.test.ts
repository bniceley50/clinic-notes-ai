import { describe, expect, it } from "vitest";
import {
  didJobReachComplete,
  deriveJobState,
  getJobTitle,
  isRetrying,
  isJobActive,
  shouldAllowAudioUpload,
  shouldShowAdvancedSection,
  shouldShowAudioPlayer,
  shouldShowEhrFields,
  shouldShowJobProgress,
  shouldShowTranscript,
} from "@/lib/models/job-lifecycle";

describe("deriveJobState", () => {
  it("returns processing state during transcription", () => {
    const state = deriveJobState({
      stage: "transcribing",
      status: "running",
      audio_storage_path: "org/session/job/recording.webm",
    });

    expect(state.isProcessing).toBe(true);
    expect(state.isComplete).toBe(false);
    expect(state.hasTranscript).toBe(false);
  });

  it("returns complete with transcript after transcription", () => {
    const state = deriveJobState(
      {
        stage: "complete",
        status: "complete",
        audio_storage_path: "org/session/job/recording.webm",
      },
      { hasTranscript: true },
    );

    expect(state.isComplete).toBe(true);
    expect(state.hasTranscript).toBe(true);
  });

  it("returns failed state", () => {
    const state = deriveJobState({
      stage: "failed",
      status: "failed",
      audio_storage_path: null,
    });

    expect(state.isFailed).toBe(true);
    expect(state.isProcessing).toBe(false);
  });

  it("sets hasAudio when audio path exists", () => {
    expect(
      deriveJobState({
        stage: "queued",
        status: "queued",
        audio_storage_path: "org/session/job/recording.webm",
      }).hasAudio,
    ).toBe(true);
  });

  it("uses transcript storage path to derive transcript availability", () => {
    expect(
      deriveJobState({
        stage: "queued",
        status: "queued",
        audio_storage_path: null,
        transcript_storage_path: "org/session/job/transcript.txt",
      }).hasTranscript,
    ).toBe(true);
  });

  it("hasTranscript is false when queued", () => {
    expect(
      deriveJobState({
        stage: "queued",
        status: "queued",
        audio_storage_path: null,
      }).hasTranscript,
    ).toBe(false);
  });
});

describe("job lifecycle decision helpers", () => {
  it("shows advanced section when transcript exists", () => {
    const state = deriveJobState(
      { stage: "complete", status: "complete", audio_storage_path: null },
      { hasTranscript: true },
    );

    expect(shouldShowAdvancedSection(state)).toBe(true);
    expect(shouldShowTranscript(state)).toBe(true);
    expect(shouldShowEhrFields(state)).toBe(true);
  });

  it("does not show transcript-driven UI when no transcript exists", () => {
    const state = deriveJobState({
      stage: "queued",
      status: "queued",
      audio_storage_path: null,
    });

    expect(shouldShowAdvancedSection(state)).toBe(false);
    expect(shouldShowTranscript(state)).toBe(false);
    expect(shouldShowEhrFields(state)).toBe(false);
  });

  it("shows audio player only when audio exists", () => {
    const state = deriveJobState({
      stage: "complete",
      status: "complete",
      audio_storage_path: "org/session/job/recording.webm",
    });

    expect(shouldShowAudioPlayer(state)).toBe(true);
  });

  it("marks queued and running jobs as active", () => {
    expect(
      isJobActive(
        deriveJobState({
          stage: "queued",
          status: "queued",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
    expect(
      isJobActive(
        deriveJobState({
          stage: "transcribing",
          status: "running",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
  });

  it("shows audio upload only for queued jobs without audio", () => {
    expect(
      shouldAllowAudioUpload(
        deriveJobState({
          stage: "queued",
          status: "queued",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
    expect(
      shouldAllowAudioUpload(
        deriveJobState({
          stage: "queued",
          status: "queued",
          audio_storage_path: "org/session/job/recording.webm",
        }),
      ),
    ).toBe(false);
  });

  it("shows job progress only while processing", () => {
    expect(
      shouldShowJobProgress(
        deriveJobState({
          stage: "transcribing",
          status: "running",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
    expect(
      shouldShowJobProgress(
        deriveJobState({
          stage: "complete",
          status: "complete",
          audio_storage_path: null,
        }),
      ),
    ).toBe(false);
  });

  it("detects completion transitions", () => {
    const previous = deriveJobState({
      stage: "transcribing",
      status: "running",
      audio_storage_path: null,
    });
    const next = deriveJobState({
      stage: "complete",
      status: "complete",
      audio_storage_path: null,
    });

    expect(didJobReachComplete(previous, next)).toBe(true);
    expect(didJobReachComplete(next, next)).toBe(false);
  });

  it("returns a display title from the canonical state", () => {
    expect(
      getJobTitle(
        deriveJobState({
          stage: "complete",
          status: "complete",
          audio_storage_path: null,
        }),
        1,
      ),
    ).toBe("Transcription complete");
    expect(
      getJobTitle(
        deriveJobState({
          stage: "queued",
          status: "cancelled",
          audio_storage_path: null,
        }),
        1,
      ),
    ).toBe("Transcription cancelled");
  });

  it('returns "Retrying transcription..." when running and attempt_count > 1', () => {
    expect(
      getJobTitle(
        deriveJobState({
          stage: "transcribing",
          status: "running",
          audio_storage_path: null,
        }),
        2,
      ),
    ).toBe("Retrying transcription...");
  });

  it('returns "Transcription failed after 3 attempts" when failed and attempts are exhausted', () => {
    expect(
      getJobTitle(
        deriveJobState({
          stage: "failed",
          status: "failed",
          audio_storage_path: null,
        }),
        3,
      ),
    ).toBe("Transcription failed after 3 attempts");
  });

  it('returns "Transcription failed" when failed before attempts are exhausted', () => {
    expect(
      getJobTitle(
        deriveJobState({
          stage: "failed",
          status: "failed",
          audio_storage_path: null,
        }),
        1,
      ),
    ).toBe("Transcription failed");
  });

  it("isRetrying returns true only for running jobs after the first attempt", () => {
    expect(isRetrying({ status: "running", attempt_count: 2 })).toBe(true);
    expect(isRetrying({ status: "running", attempt_count: 1 })).toBe(false);
    expect(isRetrying({ status: "failed", attempt_count: 2 })).toBe(false);
  });

  it("shows job progress for running jobs regardless of attempt_count", () => {
    expect(
      shouldShowJobProgress(
        deriveJobState({
          stage: "transcribing",
          status: "running",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
    expect(
      shouldShowJobProgress(
        deriveJobState({
          stage: "transcribing",
          status: "running",
          audio_storage_path: null,
        }),
      ),
    ).toBe(true);
  });
});
