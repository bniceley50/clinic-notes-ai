import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockLoadCurrentUser,
  mockGetMyNote,
  mockUpdateMyNoteContent,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyNote: vi.fn(),
  mockUpdateMyNoteContent: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/clinical/queries", () => ({
  getMyNote: mockGetMyNote,
  updateMyNoteContent: mockUpdateMyNoteContent,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
}));

import { PATCH } from "@/app/api/sessions/[sessionId]/notes/[noteId]/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
    email: "clinician@example.com",
    profile: {
      id: "profile-1",
      user_id: "user-1",
      org_id: "org-1",
      display_name: "Jane Doe",
      role: "provider",
      created_at: "2026-03-15T12:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Test Org",
      created_at: "2026-03-15T12:00:00.000Z",
    },
  },
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/sessions/session-1/notes/note-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("PATCH /api/sessions/[sessionId]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyNote.mockResolvedValue({
      data: {
        id: "note-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Existing note",
        note_type: "soap",
        status: "draft",
        created_by: "user-1",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-21T10:00:00.000Z",
      },
      error: null,
    });
    mockUpdateMyNoteContent.mockResolvedValue({
      data: {
        id: "note-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Updated note content",
        note_type: "soap",
        status: "draft",
        created_by: "user-1",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-22T10:00:00.000Z",
      },
      error: null,
    });
  });

  it("updates note content through the app route without touching immutable fields", async () => {
    const response = await PATCH(
      makeRequest({ content: "Updated note content" }) as never,
      {
        params: Promise.resolve({ sessionId: "session-1", noteId: "note-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetMyNote).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      "note-1",
    );
    expect(mockUpdateMyNoteContent).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      "note-1",
      "Updated note content",
    );
    expect(payload).toEqual({
      note: {
        id: "note-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Updated note content",
        note_type: "soap",
        status: "draft",
        created_by: "user-1",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-22T10:00:00.000Z",
      },
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      action: "note.edited",
      metadata: {
        note_id: "note-1",
      },
    });
  });
});
