/**
 * Centralized, typed environment configuration.
 *
 * Non-NEXT_PUBLIC_ variables are automatically stripped from client
 * bundles by Next.js, so server secrets cannot leak to the browser.
 *
 * Every variable is read through a typed getter so call-sites never
 * touch process.env directly.
 *
 * Required variables throw at first access if missing. Optional
 * variables return typed defaults.
 *
 * `validateConfig()` eagerly checks ALL required vars at once and
 * throws a single error listing every missing var.  Call it once at
 * startup (middleware.ts or a layout server component).
 *
 * Bootstrap-safe: during initial scaffold (before a Supabase project
 * exists), the app boots as long as no code path actually calls a
 * required getter.  `validateConfig()` is intentionally NOT called
 * from the root layout so the homepage can render without credentials.
 */

// ── Helpers ──────────────────────────────────────────────────

function requiredString(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalBoolFlag(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

function optionalPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function requiredPositiveInt(name: string): number {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `Invalid numeric environment variable: ${name} (got "${raw}", expected positive integer)`,
    );
  }
  return Math.floor(n);
}

// ── Supabase ─────────────────────────────────────────────────

export function supabaseUrl(): string {
  return requiredString("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function supabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

// ── Auth ─────────────────────────────────────────────────────

export function authCookieSecret(): string {
  return requiredString("AUTH_COOKIE_SECRET");
}

export function sessionTtlSeconds(): number {
  return requiredPositiveInt("SESSION_TTL_SECONDS");
}

export function defaultPracticeId(): string {
  return requiredString("DEFAULT_PRACTICE_ID");
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

// ── Job lifecycle ────────────────────────────────────────────

export function jobTtlSeconds(): number {
  return optionalPositiveInt("JOB_TTL_SECONDS", 86_400);
}

// ── AI API keys ──────────────────────────────────────────────

export function openaiApiKey(): string {
  return requiredString("OPENAI_API_KEY");
}

export function anthropicApiKey(): string {
  return requiredString("ANTHROPIC_API_KEY");
}

// ── AI API flags ─────────────────────────────────────────────

export function aiRealApisEnabled(): boolean {
  return optionalBoolFlag("AI_ENABLE_REAL_APIS");
}

export function aiStubApisEnabled(): boolean {
  return optionalBoolFlag("AI_ENABLE_STUB_APIS");
}

// ── AI timeouts ──────────────────────────────────────────────

export function aiWhisperTimeoutMs(): number {
  return optionalPositiveInt("AI_WHISPER_TIMEOUT_MS", 120_000);
}

export function aiClaudeTimeoutMs(): number {
  return optionalPositiveInt("AI_CLAUDE_TIMEOUT_MS", 90_000);
}

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
}

export const MAX_TRANSCRIPT_CHARS = 200_000;

// ── Security ─────────────────────────────────────────────────

export function jobsRunnerToken(): string | undefined {
  return process.env.JOBS_RUNNER_TOKEN || undefined;
}

export function redisRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function validateRedisRateLimitConfig(): void {
  const hasRedisUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedisUrl !== hasRedisToken) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together.",
    );
  }

  if (isProduction() && aiRealApisEnabled() && !hasRedisUrl) {
    throw new Error(
      "Redis-backed rate limiting is required in production when AI_ENABLE_REAL_APIS is enabled. Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.",
    );
  }
}

// ── Dev-only flags ───────────────────────────────────────────

export function isDevLoginAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    optionalBoolFlag("ALLOW_DEV_LOGIN")
  );
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ── Startup validation ───────────────────────────────────────

/**
 * Check all required env vars at once and throw a single error
 * listing every missing var. Call early (e.g. in middleware.ts)
 * but NOT from root layout — the homepage must boot without
 * credentials during initial scaffold.
 */
export function validateConfig(): void {
  const missing: string[] = [];

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "AUTH_COOKIE_SECRET",
    "SESSION_TTL_SECONDS",
    "DEFAULT_PRACTICE_ID",
  ];

  if (aiRealApisEnabled()) {
    required.push("OPENAI_API_KEY", "ANTHROPIC_API_KEY");
  }

  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  const ttlRaw = process.env.SESSION_TTL_SECONDS;
  if (ttlRaw) {
    const n = Number(ttlRaw);
    if (!Number.isFinite(n) || n <= 0) {
      missing.push("SESSION_TTL_SECONDS (invalid number)");
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Environment configuration error — missing or invalid:\n  • ${missing.join("\n  • ")}\n\nSee .env.example for required variables.`,
    );
  }
}
