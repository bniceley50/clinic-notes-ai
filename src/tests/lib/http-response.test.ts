import { describe, expect, it } from "vitest";
import { jsonNoStore, withNoStoreHeaders } from "@/lib/http/response";

describe("http response helpers", () => {
  it("adds Cache-Control no-store to JSON responses", () => {
    const response = jsonNoStore({ ok: true }, { status: 201 });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("merges Cache-Control no-store with existing headers", () => {
    const init = withNoStoreHeaders({
      headers: {
        "Content-Disposition": 'attachment; filename="note.docx"',
      },
    });
    const headers = new Headers(init.headers);

    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Content-Disposition")).toBe(
      'attachment; filename="note.docx"',
    );
  });
});
