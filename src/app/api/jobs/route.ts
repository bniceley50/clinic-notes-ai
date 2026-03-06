import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import {
  createJob,
  getActiveJobForSession,
  getJobsForSession,
  JOB_NOTE_TYPES,
  type JobNoteType,
} from "@/lib/jobs/queries";

export async function GET(request: NextRequest) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  const session = await getMySession(result.user, sessionId);
  if (session.error || !session.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await getJobsForSession(result.user, sessionId);
  if (error) {
    return NextResponse.json(
      { error: "Failed to load jobs" },
      { status: 500 },
    );
  }

  return NextResponse.json({ jobs: data });
}

export async function POST(request: NextRequest) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId =
    typeof body.session_id === "string" ? body.session_id.trim() : "";
  const noteType =
    typeof body.note_type === "string" ? body.note_type : "soap";

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  if (!JOB_NOTE_TYPES.includes(noteType as JobNoteType)) {
    return NextResponse.json(
      { error: `note_type must be one of: ${JOB_NOTE_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const session = await getMySession(result.user, sessionId);
  if (session.error || !session.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const active = await getActiveJobForSession(result.user, sessionId);
  if (active.error) {
    return NextResponse.json(
      { error: "Failed to check active jobs" },
      { status: 500 },
    );
  }

  if (active.data) {
    return NextResponse.json(
      {
        error:
          "This session already has an active job. Wait for it to finish or cancel it first.",
        job: active.data,
      },
      { status: 409 },
    );
  }

  const { data, error } = await createJob(result.user, {
    session_id: sessionId,
    note_type: noteType as JobNoteType,
  });

  if (error || !data) {
    const status = error?.includes("active job") ? 409 : 500;
    return NextResponse.json(
      { error: error ?? "Failed to create job" },
      { status },
    );
  }

  return NextResponse.json({ job: data }, { status: 201 });
}
