// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { NoteViewer } from "@/components/session/NoteViewer";

describe("NoteViewer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("uses a divide color utility for section separators", async () => {
    await act(async () => {
      root.render(
        <NoteViewer
          content={"Subjective\nPatient reports steady improvement.\n\nPlan\nContinue weekly sessions."}
          noteType="soap"
          sessionDate="2026-03-31"
          patientLabel="P-100"
          providerName="Dr. Example"
        />,
      );
    });

    const content = container.querySelector('[data-testid="clinical-note-content"]');

    expect(content).not.toBeNull();
    expect(content?.className).toContain("divide-y");
    expect(content?.className).toContain("divide-border-subtle");
    expect(content?.className).not.toContain("border-border-subtle");
  });
});
