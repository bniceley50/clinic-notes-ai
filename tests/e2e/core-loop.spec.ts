import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";

test("Milestone A core loop happy path", async ({
  context,
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);

  const runnerToken = process.env.JOBS_RUNNER_TOKEN;

  expect(runnerToken, "JOBS_RUNNER_TOKEN must be set for E2E runs").toBeTruthy();

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });

  await page.goto("/api/auth/dev-login", { waitUntil: "domcontentloaded" });
  await page.goto("/sessions", { waitUntil: "domcontentloaded" });

  const createSessionForm = page.getByTestId("create-session-form");
  await createSessionForm.getByTestId("session-patient-label").fill("E2E Test Patient");
  await createSessionForm.getByTestId("session-type-select").selectOption("general");

  await Promise.all([
    page.waitForURL(/\/sessions\/[^/]+$/, { timeout: 30_000 }),
    createSessionForm.getByTestId("create-session-submit").click(),
  ]);

  const sessionId = page.url().split("/sessions/")[1];
  expect(sessionId).toBeTruthy();

  const audioUploadPanel = page.getByTestId("audio-upload-panel");
  await audioUploadPanel.getByTestId("job-note-type").selectOption("soap");
  await audioUploadPanel.getByTestId("audio-file-input").setInputFiles({
    name: "recording.webm",
    mimeType: "audio/webm",
    buffer: Buffer.from("e2e fake audio payload"),
  });
  await audioUploadPanel.getByTestId("queue-upload-button").click();

  await expect(page.getByTestId("job-status-panel")).toContainText("queued", {
    timeout: 30_000,
  });

  const runnerResponse = await request.post("/api/jobs/runner", {
    headers: {
      authorization: `Bearer ${runnerToken}`,
    },
  });

  expect(runnerResponse.ok()).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });

  const jobStatusPanel = page.getByTestId("job-status-panel");
  await expect(jobStatusPanel.getByTestId("job-status-chip")).toContainText(
    "complete",
    { timeout: 30_000 },
  );
  await expect(jobStatusPanel.getByTestId("job-progress")).toContainText("100%");

  const transcriptViewer = page.getByTestId("session-transcript");
  await expect(transcriptViewer).toBeVisible();
  await expect(transcriptViewer.getByTestId("session-transcript-content")).toContainText(
    "[00:00:12] Provider:",
  );

  const noteViewer = page.getByTestId("clinical-note-viewer");
  await expect(noteViewer).toBeVisible();
  await expect(noteViewer.getByTestId("clinical-note-content")).toContainText(
    "SUBJECTIVE:",
  );
  await expect(noteViewer.getByTestId("clinical-note-content")).toContainText(
    "ASSESSMENT:",
  );
  await expect(noteViewer.getByTestId("clinical-note-content")).toContainText("PLAN:");

  const noteWorkspace = page.getByTestId("note-workspace");
  const editNoteButton = noteWorkspace.getByTestId("edit-note-button");
  await page.waitForTimeout(1000);
  await editNoteButton.scrollIntoViewIfNeeded();
  await editNoteButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(noteWorkspace.getByTestId("note-editor")).toBeVisible();

  const noteEditor = noteWorkspace.getByTestId("note-editor");
  const editedContent = `${await noteEditor.inputValue()}\n\nE2E edit confirmation.`;
  await noteEditor.fill(editedContent);

  await expect(noteWorkspace.getByTestId("note-save-state")).toContainText(
    "Unsaved changes",
  );

  await noteWorkspace.getByTestId("save-note-button").click();
  await expect(noteWorkspace.getByTestId("note-save-state")).toContainText(
    "All changes saved",
    { timeout: 30_000 },
  );

  await editNoteButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(noteViewer.getByTestId("clinical-note-content")).toContainText(
    "E2E edit confirmation.",
  );

  await noteWorkspace.getByTestId("copy-note-button").click();
  await expect
    .poll(async () =>
      page.evaluate(async () => navigator.clipboard.readText()),
    )
    .toContain("PATIENT LABEL: E2E Test Patient");
  await expect
    .poll(async () =>
      page.evaluate(async () => navigator.clipboard.readText()),
    )
    .toContain("SOURCE: CLINIC NOTES AI | AI-GENERATED - REVIEW REQUIRED");
  await expect
    .poll(async () =>
      page.evaluate(async () => navigator.clipboard.readText()),
    )
    .toContain("E2E edit confirmation.");

  const downloadPromise = page.waitForEvent("download");
  await noteWorkspace.getByTestId("export-note-button").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^clinic-notes-general-.*\.docx$/);

  const downloadPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(downloadPath);

  const stats = await fs.stat(downloadPath);
  expect(stats.size).toBeGreaterThan(0);
});
