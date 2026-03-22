// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useCareLogicFields } from "@/hooks/useCareLogicFields";

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

function HookHarness({ jobId }: { jobId: string }) {
  const { state, generatedAt, regenError, isRegenerating, regenerate } =
    useCareLogicFields(jobId);

  return (
    <div>
      <div data-testid="loading">{String(state.loading)}</div>
      <div data-testid="field">
        {state.fields?.client_perspective ?? "no-fields"}
      </div>
      <div data-testid="generated-at">{generatedAt ?? "no-generated-at"}</div>
      <div data-testid="regen-error">{regenError ?? "no-regen-error"}</div>
      <div data-testid="regenerating">{String(isRegenerating)}</div>
      <button type="button" onClick={() => void regenerate()}>
        Regenerate
      </button>
    </div>
  );
}

describe("useCareLogicFields", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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

  async function renderHarness(jobId = "job-1"): Promise<void> {
    await act(async () => {
      root.render(<HookHarness jobId={jobId} />);
    });
  }

  it("initial load sets state correctly", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        fields: { client_perspective: "Stored value" },
        generated_at: "2026-03-22T00:00:00.000Z",
      }),
    );

    await renderHarness();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/carelogic-fields");
    expect(container.textContent).toContain("Stored value");
    expect(
      container.querySelector('[data-testid="generated-at"]')?.textContent,
    ).not.toBe("no-generated-at");
    expect(container.querySelector('[data-testid="loading"]')?.textContent).toBe(
      "false",
    );
  });

  it("regen failure preserves existing fields and exposes the regen error", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          fields: { client_perspective: "Stored value" },
          generated_at: "2026-03-22T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse(
          { error: "Unable to load structured fields from this transcript." },
          500,
        ),
      );

    await renderHarness();
    await flushPromises();

    const regenerateButton = container.querySelector("button");
    if (!(regenerateButton instanceof HTMLButtonElement)) {
      throw new Error("Regenerate button not found");
    }

    await act(async () => {
      regenerateButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await flushPromises();

    expect(container.textContent).toContain("Stored value");
    expect(container.textContent).toContain(
      "Unable to load structured fields from this transcript.",
    );
    expect(container.querySelector('[data-testid="loading"]')?.textContent).toBe(
      "false",
    );
  });

  it("single-flight guard prevents concurrent regen calls", async () => {
    const regeneratePending = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          fields: { client_perspective: "Stored value" },
          generated_at: "2026-03-22T00:00:00.000Z",
        }),
      )
      .mockReturnValueOnce(regeneratePending.promise);

    await renderHarness();
    await flushPromises();

    const regenerateButton = container.querySelector("button");
    if (!(regenerateButton instanceof HTMLButtonElement)) {
      throw new Error("Regenerate button not found");
    }

    await act(async () => {
      regenerateButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      regenerateButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/jobs/job-1/carelogic-fields?regenerate=true",
    );

    regeneratePending.resolve(
      makeJsonResponse({
        fields: { client_perspective: "Regenerated value" },
        generated_at: "2026-03-22T01:00:00.000Z",
      }),
    );
    await flushPromises();
  });
});
