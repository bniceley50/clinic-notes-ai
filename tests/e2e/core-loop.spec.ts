import { expect, test } from "@playwright/test";

test("Milestone A core loop happy path", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });

  await page.goto("/api/auth/dev-login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL("/", { timeout: 10000 });
  await page.goto("/sessions", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const createSessionForm = page.getByTestId("create-session-form");
  await expect(createSessionForm).toBeVisible({ timeout: 10000 });
  await createSessionForm.getByTestId("session-patient-label").fill("E2E Test Patient");
  await createSessionForm.getByTestId("session-type-select").selectOption("general");

  await Promise.all([
    page.waitForURL(/\/sessions\/[^/]+$/, { timeout: 30_000 }),
    createSessionForm.getByTestId("create-session-submit").click(),
  ]);

  await expect(page).toHaveURL(/\/sessions\//, { timeout: 15_000 });
  // TODO: audio upload → job processing → note viewing assertions
  // Activate when AudioUpload, JobStatusPanel, NoteViewer are
  // fully wired into session detail page with real job pipeline
});
