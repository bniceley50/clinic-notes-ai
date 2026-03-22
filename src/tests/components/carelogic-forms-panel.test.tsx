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

function deferredResponse() {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("CareLogicFormsPanel", () => {
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

  async function renderPanel(): Promise<void> {
    await act(async () => {
      root.render(
        <CareLogicFormsPanel jobId="job-1" sessionType="general" />,
      );
    });
  }

  it("shows generated_at timestamp and Regenerate button when fields are loaded", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        fields: { client_perspective: "Stored value" },
        generated_at: "2026-03-22T00:00:00.000Z",
        sessionType: "general",
      }),
    );

    await renderPanel();
    await flushPromises();

    expect(container.textContent).toContain("Generated");
    expect(container.textContent).toContain("Regenerate");
  });

  it('does not show "Regenerate" while loading and shows the new loading copy', async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise);

    await renderPanel();

    expect(container.textContent).toContain("Extracting EHR-ready fields...");
    expect(container.textContent).not.toContain("Regenerate");

    pending.resolve(
      makeJsonResponse({
        fields: { client_perspective: "Loaded later" },
        generated_at: "2026-03-22T00:00:00.000Z",
        sessionType: "general",
      }),
    );
    await flushPromises();
  });

  it("clicking Regenerate calls the endpoint with regenerate=true and shows loading state", async () => {
    const regeneratePending = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          fields: { client_perspective: "Stored value" },
          generated_at: "2026-03-22T00:00:00.000Z",
          sessionType: "general",
        }),
      )
      .mockReturnValueOnce(regeneratePending.promise);

    await renderPanel();
    await flushPromises();

    const regenerateButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Regenerate"));

    if (!(regenerateButton instanceof HTMLButtonElement)) {
      throw new Error("Regenerate button not found");
    }

    await act(async () => {
      regenerateButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/jobs/job-1/carelogic-fields?regenerate=true",
    );
    expect(container.textContent).toContain("Extracting EHR-ready fields...");

    regeneratePending.resolve(
      makeJsonResponse({
        fields: { client_perspective: "Regenerated value" },
        generated_at: "2026-03-22T01:00:00.000Z",
        sessionType: "general",
      }),
    );
    await flushPromises();
  });

  it("shows error state on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({ error: "Failed to load EHR fields" }, 500),
    );

    await renderPanel();
    await flushPromises();

    expect(container.textContent).toContain("Failed to load EHR fields");
    expect(container.textContent).toContain("Retry");
  });
});
