// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { ConsentStatus } from "@/lib/models/consent";

vi.mock("@/components/jobs/AudioUpload", () => ({
  AudioUpload: ({
    onUploaded,
  }: {
    jobId: string;
    onUploaded: (storagePath: string) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-audio-upload"
      onClick={() => onUploaded("org-1/session-1/job-1/recording.webm")}
    >
      Mock upload
    </button>
  ),
}));

vi.mock("@/components/jobs/AudioRecorder", () => ({
  AudioRecorder: ({
    onUploaded,
  }: {
    jobId: string;
    onUploaded: (storagePath: string) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-audio-recorder"
      onClick={() => onUploaded("org-1/session-1/job-1/recording.webm")}
    >
      Mock record
    </button>
  ),
}));

vi.mock("@/components/jobs/ConsentGate", () => ({
  ConsentGate: () => <div data-testid="mock-consent-gate" />,
}));

import { CreateJobForm } from "@/components/jobs/CreateJobForm";
import type { JobSnapshot } from "@/components/jobs/JobStatusPanel";

const recordedConsent: ConsentStatus = {
  state: "recorded",
  recordedAt: "2026-03-21T12:00:00.000Z",
  type: "standard",
};

function makeJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

function getButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

describe("CreateJobForm trigger failures", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  let onJobStarted: ReturnType<typeof vi.fn<(job: JobSnapshot) => void>>;

  beforeEach(async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn();
    reloadMock = vi.fn();
    onJobStarted = vi.fn<(job: JobSnapshot) => void>();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadMock,
      },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <CreateJobForm
          sessionId="session-1"
          hasActiveJob={false}
          consentStatus={recordedConsent}
          onJobStarted={onJobStarted}
        />,
      );
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function createJobAndUpload(): Promise<void> {
    const form = container.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Form not found");
    }

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushPromises();

    await click(getButtonByText(container, "Upload file"));
    await click(container.querySelector('[data-testid="mock-audio-upload"]')!);
    await flushPromises();
  }

  it("shows an explicit error when the trigger API call fails and never shows the old success copy", async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ job: { id: "job-1" } }, 201))
      .mockResolvedValueOnce(
        makeJsonResponse({ error: "Failed to start processing" }, 500),
      );

    await createJobAndUpload();

    expect(container.textContent).toContain("Failed to start processing");
    expect(container.textContent).not.toContain(
      "Audio uploaded - transcription will begin shortly",
    );
  });

  it("keeps the page in place and shows a retry option when upload succeeds but trigger fails", async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ job: { id: "job-1" } }, 201))
      .mockResolvedValueOnce(
        makeJsonResponse({ error: "Processing service unavailable" }, 500),
      );

    await createJobAndUpload();

    expect(reloadMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Processing service unavailable");
    expect(getButtonByText(container, "Try again")).toBeTruthy();
  });

  it("shows processing started when the trigger succeeds", async () => {
    const createdJob: JobSnapshot = {
      id: "job-1",
      session_id: "session-1",
      status: "queued",
      stage: "queued",
      progress: 0,
      note_type: "soap",
      attempt_count: 0,
      errorCode: null,
      hasAudio: false,
      hasTranscript: false,
      hasDraft: false,
      created_at: "2026-03-22T00:00:00.000Z",
      updated_at: "2026-03-22T00:00:00.000Z",
    };

    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ job: createdJob }, 201))
      .mockResolvedValueOnce(
        makeJsonResponse({ job_id: "job-1", status: "processing" }, 202),
      );

    await createJobAndUpload();

    expect(container.textContent).toContain("Audio uploaded - transcription started");
    expect(reloadMock).not.toHaveBeenCalled();
    expect(onJobStarted).toHaveBeenCalledWith({
      ...createdJob,
      hasAudio: true,
    });
  });
});
