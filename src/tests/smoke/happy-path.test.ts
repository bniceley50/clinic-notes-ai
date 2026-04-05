/**
 * Core happy-path smoke test.
 *
 * Runs the app's wiring without a dev server: create session, create job,
 * finalize upload, process transcript, and fetch EHR fields.
 *
 * Run manually:
 *   RUN_SMOKE_TESTS=1 TEST_SUPABASE_URL=... TEST_SUPABASE_ANON_KEY=... TEST_SUPABASE_SERVICE_ROLE_KEY=... pnpm vitest run src/tests/smoke/happy-path.test.ts
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/auth/loader";

let admin: SupabaseClient;
let appUser: AppUser;
const sessionIds: string[] = [];

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => admin }));
vi.mock("@/lib/auth/loader", () => ({ loadCurrentUser: vi.fn(async () => ({ status: "authenticated", user: appUser })) }));
vi.mock("@/lib/rate-limit", () => ({ apiLimit: null, getIdentifier: vi.fn(() => "user:smoke"), checkRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/logger", () => ({ withLogging: <T>(handler: T) => handler }));
vi.mock("@/lib/storage/audio", () => ({
  buildAudioStoragePath: ({ orgId, sessionId, jobId, fileName }: { orgId: string; sessionId: string; jobId: string; fileName: string }) => `${orgId}/${sessionId}/${jobId}/recording.${fileName.split(".").pop() ?? "webm"}`,
  finalizeJobAudioUploadForOrg: vi.fn(async ({ orgId, sessionId, jobId, storagePath }: { orgId: string; sessionId: string; jobId: string; storagePath: string }) => {
    const { error } = await admin.from("jobs").update({ audio_storage_path: storagePath, updated_at: new Date().toISOString() }).eq("org_id", orgId).eq("session_id", sessionId).eq("id", jobId);
    return { storagePath: error ? null : storagePath, error: error?.message ?? null };
  }),
}));
vi.mock("@/lib/storage/audio-download", () => ({ downloadAudioBlobGlobally: vi.fn(async () => ({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "audio/webm" }), error: null })) }));
vi.mock("@/lib/ai/whisper", () => ({ transcribeAudioChunked: vi.fn(async () => ({ text: "Client reports improved mood and better sleep.", error: null })) }));
vi.mock("@/lib/storage/transcript", () => ({ uploadTranscript: vi.fn(async ({ orgId, sessionId, jobId }: { orgId: string; sessionId: string; jobId: string }) => ({ storagePath: `${orgId}/${sessionId}/${jobId}/transcript.txt`, error: null })) }));
vi.mock("@/lib/config", async () => ({ ...(await vi.importActual<typeof import("@/lib/config")>("@/lib/config")), anthropicApiKey: () => "test-anthropic-key", aiRealApisEnabled: () => true }));

import { createSession, softDeleteSession } from "@/lib/sessions/queries";
import { createJob, getGlobalJobById } from "@/lib/jobs/queries";
import { processJob } from "@/lib/jobs/processor";
import { POST as postUploadComplete } from "@/app/api/jobs/[id]/upload-complete/route";
import { GET as getCarelogicFields } from "@/app/api/jobs/[id]/carelogic-fields/route";

const envReady = Boolean(process.env.RUN_SMOKE_TESTS === "1" && process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_ANON_KEY && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);
const describeSmoke = envReady ? describe : describe.skip;

describeSmoke("smoke happy path", () => {
  beforeAll(async () => {
    admin = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("profiles").select("id, user_id, org_id, display_name, role, created_at, orgs(id, name, created_at)").limit(1).single();
    if (!profile) throw new Error("Smoke harness requires an existing profile row");
    appUser = {
      userId: profile.user_id,
      orgId: profile.org_id,
      role: profile.role,
      email: "smoke@example.com",
      profile: { id: profile.id, user_id: profile.user_id, org_id: profile.org_id, display_name: profile.display_name, role: profile.role, created_at: profile.created_at },
      org: Array.isArray(profile.orgs) ? profile.orgs[0] : profile.orgs,
    };
  });

  afterEach(async () => {
    if (sessionIds.length === 0) return;
    for (const sessionId of sessionIds.splice(0)) {
      await softDeleteSession(appUser, sessionId);
    }
    vi.unstubAllGlobals();
  });

  it("creates a session, creates a job, attaches audio, completes processing, and extracts EHR fields", async () => {
    const createdSession = await createSession(appUser, { patient_label: "Smoke Test Patient", session_type: "general" });
    expect(createdSession.data?.id).toBeTruthy();
    sessionIds.push(createdSession.data!.id);

    const createdJob = await createJob(appUser, { session_id: createdSession.data!.id });
    expect(createdJob.data?.id).toBeTruthy();

    const uploadResponse = await postUploadComplete(new Request("http://localhost/api/jobs/upload-complete", { method: "POST", headers: { "content-type": "application/json", "x-vercel-id": "smoke-upload" }, body: JSON.stringify({ fileName: "smoke.webm", fileSizeBytes: 128 }) }) as never, { params: Promise.resolve({ id: createdJob.data!.id }) });
    expect(uploadResponse.status).toBe(200);

    const processed = await processJob(createdJob.data!.id);
    expect(processed).toEqual({ success: true, error: null });

    const refreshedJob = await getGlobalJobById(createdJob.data!.id);
    expect(refreshedJob?.status).toBe("complete");
    expect(refreshedJob?.transcript_storage_path).toBeTruthy();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "{\"client_perspective\":\"Client reported improved mood.\",\"current_status_interventions\":\"Clinician reinforced coping skills.\",\"response_to_interventions\":\"Client was receptive.\",\"since_last_visit\":\"Improved sleep.\",\"goals_addressed\":\"Mood stabilization.\",\"interactive_complexity\":\"[Insufficient information in transcript]\",\"coordination_of_care\":\"[Insufficient information in transcript]\",\"mse_summary\":\"Calm and cooperative.\"}" }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const carelogicResponse = await getCarelogicFields(new Request(`http://localhost/api/jobs/${createdJob.data!.id}/carelogic-fields`, { headers: { "x-vercel-id": "smoke-carelogic" } }) as never, { params: Promise.resolve({ id: createdJob.data!.id }) });
    const carelogicPayload = await carelogicResponse.json();
    expect(carelogicResponse.status).toBe(200);
    expect(Object.keys(carelogicPayload.fields ?? {})).not.toHaveLength(0);
  });
});
