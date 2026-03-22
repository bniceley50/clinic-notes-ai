import { beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
} from "../../lib/auth/session";

describe("auth session helpers", () => {
  beforeEach(() => {
    process.env.AUTH_COOKIE_SECRET = "test-auth-cookie-secret-1234567890";
    process.env.SESSION_TTL_SECONDS = "3600";
  });

  it("returns user data for a valid session token", async () => {
    const cookie = await createSessionCookie({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "clinician@example.com",
      practiceId: "org-1",
      role: "provider",
    });

    const session = await readSessionFromCookieHeader(cookie);

    expect(session).toMatchObject({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "clinician@example.com",
      practiceId: "org-1",
      role: "provider",
    });
    expect(session?.jti).toBeTypeOf("string");
    expect(cookie).toContain("SameSite=lax");
  });

  it("returns null for an expired session token", async () => {
    const encoder = new TextEncoder();
    const secret = encoder.encode(process.env.AUTH_COOKIE_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      sub: "00000000-0000-0000-0000-000000000001",
      practiceId: "org-1",
      role: "provider",
      jti: "expired-jti",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(secret);

    const session = await readSessionFromCookieHeader(
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    );

    expect(session).toBeNull();
  });

  it("rejects a malformed session token", async () => {
    const session = await readSessionFromCookieHeader(
      `${SESSION_COOKIE_NAME}=not-a-jwt`,
    );

    expect(session).toBeNull();
  });

  it("clears the session cookie with SameSite=Lax", () => {
    const cookie = clearSessionCookie();

    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=0");
  });
});
