// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { CareLogicFormsPanel } from "@/components/session/CareLogicFormsPanel";

function makeJsonResponse(body: unknown, status = 200): Response {
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

describe("CareLogicFormsPanel boundaries", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(),
      },
    });

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

  async function renderPanel(jobId: string, sessionType: string): Promise<void> {
    await act(async () => {
      root.render(<CareLogicFormsPanel jobId={jobId} sessionType={sessionType} />);
    });
  }

  it("jobId missing renders the no-job state and does not fetch", async () => {
    await renderPanel("", "general");
    await flushPromises();

    expect(container.textContent).toContain(
      "EHR field extraction is unavailable until transcription has completed for this session.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("session type switches rendered sections", async () => {
    fetchMock.mockResolvedValue(
      makeJsonResponse({
        fields: {
          presenting_problem: "Stored value",
          client_perspective: "Stored value",
        },
        generated_at: "2026-03-22T00:00:00.000Z",
      }),
    );

    await renderPanel("job-1", "intake");
    await flushPromises();

    expect(container.textContent).toContain("Presenting Problem");
    expect(container.textContent).not.toContain(
      "Individual Session Documentation",
    );

    await renderPanel("job-1", "general");
    await flushPromises();

    expect(container.textContent).toContain(
      "Individual Session Documentation",
    );
    expect(container.textContent).not.toContain("Presenting Problem");
  });
});
