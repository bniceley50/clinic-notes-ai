import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET } from "../../app/api/auth/callback/route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects token_hash links to /set-password with params preserved", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/callback?token_hash=valid-token&type=invite&next=/sessions",
    );

    const response = await GET(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/set-password?token_hash=valid-token&type=invite&next=%2Fsessions",
    );
  });

  it("redirects code links to /set-password without consuming the auth material", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=legacy-code",
    );

    const response = await GET(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/set-password?code=legacy-code",
    );
  });

  it("redirects empty callback requests to /set-password", async () => {
    const request = new Request("http://localhost:3000/api/auth/callback");

    const response = await GET(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/set-password");
  });
});
