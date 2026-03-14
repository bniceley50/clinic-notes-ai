import { expect, test } from "@playwright/test";

test("Milestone A core loop happy path", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });

  const loginResponse = await page.request.get("/api/auth/dev-login", {
    maxRedirects: 0,
  });
  expect(loginResponse.status()).toBe(303);
  expect(loginResponse.headers()["location"]).toContain("/sessions");

  const setCookie = loginResponse.headers()["set-cookie"];
  const sessionMatch = setCookie?.match(/cna_session=([^;]+)/);
  expect(sessionMatch?.[1], "dev-login must return cna_session cookie").toBeTruthy();

  await context.addCookies([
    {
      name: "cna_session",
      value: decodeURIComponent(sessionMatch![1]),
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const cookies = await context.cookies("http://localhost:3000");
  const sessionCookie = cookies.find((c) => c.name === "cna_session");
  expect(sessionCookie, "dev-login must set cna_session cookie").toBeTruthy();

  await page.goto("/sessions", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/sessions/, { timeout: 10_000 });

  const createSessionForm = page.getByTestId("create-session-form");
  await expect(createSessionForm).toBeVisible({ timeout: 10000 });
  await createSessionForm.getByTestId("session-patient-label").fill("E2E Test Patient");
  await createSessionForm.getByTestId("session-type-select").selectOption("general");

  await Promise.all([
    page.waitForURL(/\/sessions\/[^/]+$/, { timeout: 30_000 }),
    createSessionForm.getByTestId("create-session-submit").click(),
  ]);

  await expect(page).toHaveURL(/\/sessions\//, { timeout: 15_000 });

  // TODO: audio upload -> job processing assertions
  // Activate when AudioUpload is wired into session detail page
  // and job pipeline is connected end to end

  // TODO: transcript viewer assertions
  // Activate when audio upload -> job pipeline is wired
  // TranscriptViewer renders when transcript data exists

  // TODO: note viewer assertions
  // Activate when audio upload -> job pipeline is wired
  // NoteWorkspace renders when note data exists
});
