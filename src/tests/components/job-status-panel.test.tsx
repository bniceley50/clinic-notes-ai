// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/components/jobs/AudioUpload", () => ({
  AudioUpload: () => <div data-testid="mock-audio-upload" />,
}));

import {
  JobStatusPanel,
  type JobSnapshot,
} from "@/components/jobs/JobStatusPanel";

function makeJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    session_id: "session-1",
    status: "queued",
    stage: "queued",
    progress: 0,
    note_type: "soap",
    attempt_count: 1,
    error_message: null,
    audio_storage_path: null,
    transcript_storage_path: null,
    created_at: "2026-03-22T00:00:00.000Z",
    updated_at: "2026-03-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("JobStatusPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "setInterval",
      vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>),
    );
    vi.stubGlobal("clearInterval", vi.fn());

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderJobs(jobs: JobSnapshot[]): Promise<void> {
    await act(async () => {
      root.render(<JobStatusPanel initialJobs={jobs} />);
    });
  }

  it('shows "Transcription queued" for queued jobs', async () => {
    await renderJobs([makeJob()]);

    expect(container.textContent).toContain("Transcription queued");
  });

  it('shows "Transcription in progress" for first-attempt running jobs', async () => {
    await renderJobs([
      makeJob({
        status: "running",
        stage: "transcribing",
        progress: 35,
        audio_storage_path: "audio/path.webm",
      }),
    ]);

    expect(container.textContent).toContain("Transcription in progress");
    expect(container.textContent).not.toContain("Retrying transcription...");
  });

  it('shows "Retrying transcription..." and retry count for retried running jobs', async () => {
    await renderJobs([
      makeJob({
        status: "running",
        stage: "transcribing",
        progress: 35,
        attempt_count: 2,
        audio_storage_path: "audio/path.webm",
      }),
    ]);

    expect(container.textContent).toContain("Retrying transcription...");
    expect(container.textContent).toContain("Retry 2 of 3");
  });

  it('shows failed-after-3 title, guidance, error, and attempts for exhausted jobs', async () => {
    await renderJobs([
      makeJob({
        status: "failed",
        stage: "failed",
        progress: 42,
        attempt_count: 3,
        error_message: "Whisper request failed",
      }),
    ]);

    expect(container.textContent).toContain("Transcription failed after 3 attempts");
    expect(container.textContent).toContain("Whisper request failed");
    expect(container.textContent).toContain("What to do next");
    expect(container.textContent).toContain(
      "The transcription could not be completed after 3 attempts. Please try uploading the audio again or contact support if the problem continues.",
    );
    expect(container.textContent).toContain("Attempts:");
    expect(container.textContent).toContain("3");
  });

  it('shows "Transcription cancelled" for cancelled jobs', async () => {
    await renderJobs([
      makeJob({
        status: "cancelled",
        stage: "queued",
      }),
    ]);

    expect(container.textContent).toContain("Transcription cancelled");
  });
});
