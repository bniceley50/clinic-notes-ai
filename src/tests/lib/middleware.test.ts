import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockReadSessionFromCookieHeader = vi.fn();
const mockIsSessionRevoked = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  clearSessionCookie: vi.fn(() => "cna_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"),
  readSessionFromCookieHeader: mockReadSessionFromCookieHeader,
}));

vi.mock("@/lib/auth/claims", () => ({
  toSessionUser: vi.fn(() => ({
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
  })),
}));

vi.mock("@/lib/auth/revocation", () => ({
  isSessionRevoked: mockIsSessionRevoked,
}));

describe("middleware public paths", () => {
  it("allows set-password without requiring an app session", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("https://clinic-notes-ai.vercel.app/set-password");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockReadSessionFromCookieHeader).not.toHaveBeenCalled();
    expect(mockIsSessionRevoked).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated protected page to login", async () => {
    mockReadSessionFromCookieHeader.mockResolvedValueOnce(null);

    const { middleware } = await import("@/middleware");
    const request = new NextRequest("https://clinic-notes-ai.vercel.app/sessions");

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://clinic-notes-ai.vercel.app/login?next=%2Fsessions",
    );
  });
});
