import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMySession,
  mockGetMyNote,
  mockBuildNoteDocxBuffer,
  mockBuildDocxFilename,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMySession: vi.fn(),
  mockGetMyNote: vi.fn(),
  mockBuildNoteDocxBuffer: vi.fn(),
  mockBuildDocxFilename: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/clinical/queries", () => ({
  getMyNote: mockGetMyNote,
}));

vi.mock("@/lib/clinical/note-export", () => ({
  buildNoteDocxBuffer: mockBuildNoteDocxBuffer,
}));

vi.mock("@/lib/clinical/note-format", () => ({
  buildDocxFilename: mockBuildDocxFilename,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
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

import { GET } from "@/app/api/sessions/[sessionId]/notes/[noteId]/export/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
    email: "user@example.com",
    profile: {
      id: "profile-1",
      user_id: "user-1",
      org_id: "org-1",
      display_name: "User One",
      role: "provider",
      created_at: "2026-03-09T10:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Org One",
      created_at: "2026-03-09T10:00:00.000Z",
    },
  },
};

function makeRequest(): Request {
  return new Request(
    "http://localhost:3000/api/sessions/session-1/notes/note-1/export",
    {
      method: "GET",
    },
  );
}

describe("GET /api/sessions/[sessionId]/notes/[noteId]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMySession.mockResolvedValue({
      data: {
        id: "session-1",
        created_at: "2026-03-17T12:00:00.000Z",
        patient_label: "Patient A",
        session_type: "therapy",
      },
      error: null,
    });
    mockGetMyNote.mockResolvedValue({
      data: {
        id: "note-1",
        session_id: "session-1",
        note_type: "soap",
        content: "Draft note content",
      },
      error: null,
    });
    mockBuildNoteDocxBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockBuildDocxFilename.mockReturnValue("session-note.docx");
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("writes a note.exported audit event for successful exports", async () => {
    const response = await GET(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1", noteId: "note-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      action: "note.exported",
      metadata: {
        note_id: "note-1",
      },
    });
  });
});
