import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const mutableEnv = process.env as Record<string, string | undefined>;

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

async function loadConfigModule() {
  vi.resetModules();
  return import("@/lib/config");
}

afterEach(() => {
  restoreEnv();
});

describe("validateRedisRateLimitConfig", () => {
  it("allows missing Redis config outside production", async () => {
    mutableEnv.NODE_ENV = "development";
    delete process.env.AI_ENABLE_REAL_APIS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { validateRedisRateLimitConfig } = await loadConfigModule();

    expect(() => validateRedisRateLimitConfig()).not.toThrow();
  });

  it("throws if only one Redis env var is set", async () => {
    mutableEnv.NODE_ENV = "production";
    process.env.AI_ENABLE_REAL_APIS = "1";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { validateRedisRateLimitConfig } = await loadConfigModule();

    expect(() => validateRedisRateLimitConfig()).toThrow(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together.",
    );
  });

  it("throws in production when real AI APIs are enabled without Redis", async () => {
    mutableEnv.NODE_ENV = "production";
    process.env.AI_ENABLE_REAL_APIS = "1";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { validateRedisRateLimitConfig } = await loadConfigModule();

    expect(() => validateRedisRateLimitConfig()).toThrow(
      "Redis-backed rate limiting is required in production when AI_ENABLE_REAL_APIS is enabled.",
    );
  });
});

describe("anthropicModel", () => {
  it("returns the default model when ANTHROPIC_MODEL is unset", async () => {
    delete process.env.ANTHROPIC_MODEL;

    const { anthropicModel } = await loadConfigModule();

    expect(anthropicModel()).toBe("claude-sonnet-4-20250514");
  });

  it("returns the configured model when ANTHROPIC_MODEL is set", async () => {
    process.env.ANTHROPIC_MODEL = "claude-test-model";

    const { anthropicModel } = await loadConfigModule();

    expect(anthropicModel()).toBe("claude-test-model");
  });
});
