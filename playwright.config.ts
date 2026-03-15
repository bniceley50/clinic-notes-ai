import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const E2E_DEFAULT_PRACTICE_ID = "00000000-0000-0000-0000-000000000123";

if (existsSync(".env.local")) {
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex);
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(name in process.env)) {
      process.env[name] = value;
    }
  }
}

process.env.ALLOW_DEV_LOGIN ??= "1";
process.env.DEFAULT_PRACTICE_ID ??= E2E_DEFAULT_PRACTICE_ID;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
    },
  ],
  webServer: {
    command: "pnpm dev --port 3000",
    env: {
      ...process.env,
      NODE_ENV: "development",
      ALLOW_DEV_LOGIN: process.env.ALLOW_DEV_LOGIN,
      DEFAULT_PRACTICE_ID: process.env.DEFAULT_PRACTICE_ID,
    },
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
