/**
 * Repeatable smoke test for job detail, polling, and worker update path.
 *
 * Tests:
 *   1.  GET /api/jobs/:id returns job for owner
 *   2.  GET /api/jobs/:id returns 404 for non-owner
 *   3.  GET /api/jobs/:id returns 401 without auth
 *   4.  Worker endpoint rejects requests without token
 *   5.  Worker endpoint rejects invalid bearer token
 *   6.  Worker endpoint updates status: queued → running
 *   7.  Worker endpoint updates stage + progress mid-run
 *   8.  Worker endpoint rejects invalid transition (running → queued)
 *   9.  Worker endpoint transitions running → complete
 *   10. Worker endpoint rejects update on terminal job
 *   11. Worker endpoint rejects invalid stage value
 *   12. Worker endpoint rejects out-of-range progress
 *   13. Polling endpoint reflects worker updates
 *   14. Session detail page loads with updated job state
 *
 * Prerequisites:
 *   - Local Supabase running (npx supabase start)
 *   - App dev server running on APP_PORT (default 3099)
 *   - JOBS_RUNNER_TOKEN set in .env.local
 *
 * Usage:
 *   node scripts/smoke-job-detail.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import crypto from "node:crypto";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const RUNNER_TOKEN = process.env.JOBS_RUNNER_TOKEN || "dev-runner-token-change-me";

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function createTestUser(email, orgName) {
  const { data: org } = await db
    .from("orgs")
    .insert({ name: orgName })
    .select("id")
    .single();

  const { data: auth } = await db.auth.admin.createUser({
    email,
    password: "testpass1234",
    email_confirm: true,
  });

  await db.from("profiles").insert({
    user_id: auth.user.id,
    org_id: org.id,
    display_name: email.split("@")[0],
    role: "provider",
  });

  return { userId: auth.user.id, orgId: org.id };
}

async function mintJwt(userId, orgId) {
  const secret = new TextEncoder().encode(
    process.env.AUTH_COOKIE_SECRET ||
      "4oE9v3iCwJ6V3dXVsmbOqwt4V6kSx4PJuwITZYUongbXsZFLUKPeip2HvOEyTvLJ",
  );
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: userId,
    email: `${userId}@test.com`,
    practiceId: orgId,
    role: "provider",
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secret);
}

async function cleanup(userIds, orgIds, sessionIds) {
  for (const sid of sessionIds) {
    await db.from("jobs").delete().eq("session_id", sid);
    await db.from("sessions").delete().eq("id", sid);
  }
  for (const uid of userIds) {
    await db.from("profiles").delete().eq("user_id", uid);
    await db.auth.admin.deleteUser(uid);
  }
  for (const oid of orgIds) {
    await db.from("orgs").delete().eq("id", oid);
  }
}

const APP_PORT = process.env.APP_PORT || "3099";
const BASE = `http://localhost:${APP_PORT}`;

async function workerPost(jobId, body) {
  return fetch(`${BASE}/api/jobs/${jobId}/worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

async function run() {
  console.log("\n=== Job Detail / Polling / Worker Smoke Test ===\n");

  const suffix = Date.now();
  const userA = await createTestUser(
    `detail-a-${suffix}@test.com`,
    `Detail Org A ${suffix}`,
  );
  const userB = await createTestUser(
    `detail-b-${suffix}@test.com`,
    `Detail Org B ${suffix}`,
  );
  const jwtA = await mintJwt(userA.userId, userA.orgId);
  const jwtB = await mintJwt(userB.userId, userB.orgId);

  const sessionIds = [];

  try {
    // Setup: create session and job for provider A
    const { data: sessionA } = await db
      .from("sessions")
      .insert({
        org_id: userA.orgId,
        created_by: userA.userId,
        patient_label: "Detail Test Patient",
        session_type: "general",
      })
      .select("id")
      .single();
    sessionIds.push(sessionA.id);

    const { data: jobA } = await db
      .from("jobs")
      .insert({
        session_id: sessionA.id,
        org_id: userA.orgId,
        created_by: userA.userId,
        note_type: "soap",
      })
      .select("id")
      .single();

    // ── 1. Owner can GET job detail ──
    console.log("1. GET /api/jobs/:id (owner)");
    const ownerRes = await fetch(`${BASE}/api/jobs/${jobA.id}`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(ownerRes.status === 200, "owner gets 200");
    const ownerJob = await ownerRes.json();
    assert(ownerJob.id === jobA.id, "correct job ID returned");
    assert(ownerJob.status === "queued", "status is queued");
    assert(ownerJob.stage === "queued", "stage is queued");
    assert(ownerJob.progress === 0, "progress is 0");

    // ── 2. Non-owner gets 404 ──
    console.log("2. GET /api/jobs/:id (non-owner)");
    const otherRes = await fetch(`${BASE}/api/jobs/${jobA.id}`, {
      headers: { Cookie: `cna_session=${jwtB}` },
    });
    assert(otherRes.status === 404, "non-owner gets 404");

    // ── 3. Unauthenticated gets 401 ──
    console.log("3. GET /api/jobs/:id (no auth)");
    const unauthRes = await fetch(`${BASE}/api/jobs/${jobA.id}`);
    assert(
      unauthRes.status === 401 || unauthRes.status === 307,
      "unauthenticated gets 401 or redirect",
    );

    // ── 4. Worker endpoint without token ──
    console.log("4. Worker POST without auth header");
    const noTokenRes = await fetch(`${BASE}/api/jobs/${jobA.id}/worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    assert(noTokenRes.status === 403, "no token → 403");

    // ── 5. Worker endpoint with bad token ──
    console.log("5. Worker POST with invalid token");
    const badTokenRes = await fetch(`${BASE}/api/jobs/${jobA.id}/worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ status: "running" }),
    });
    assert(badTokenRes.status === 403, "bad token → 403");

    // ── 6. Worker: queued → running ──
    console.log("6. Worker: queued → running");
    const startRes = await workerPost(jobA.id, { status: "running", stage: "transcribing" });
    assert(startRes.status === 200, "transition accepted");
    const startBody = await startRes.json();
    assert(startBody.status === "running", "status updated to running");
    assert(startBody.stage === "transcribing", "stage updated to transcribing");

    // ── 7. Worker: update progress mid-run ──
    console.log("7. Worker: progress update");
    const progRes = await workerPost(jobA.id, { progress: 45, stage: "drafting" });
    assert(progRes.status === 200, "progress update accepted");
    const progBody = await progRes.json();
    assert(progBody.progress === 45, "progress is 45");
    assert(progBody.stage === "drafting", "stage is drafting");

    // ── 8. Worker: invalid backward transition ──
    console.log("8. Worker: running → queued (invalid)");
    const backRes = await workerPost(jobA.id, { status: "queued" });
    assert(backRes.status === 422, "backward transition → 422");

    // ── 9. Worker: running → complete ──
    console.log("9. Worker: running → complete");
    const completeRes = await workerPost(jobA.id, {
      status: "complete",
      stage: "complete",
      progress: 100,
    });
    assert(completeRes.status === 200, "complete transition accepted");
    const completeBody = await completeRes.json();
    assert(completeBody.status === "complete", "status is complete");
    assert(completeBody.progress === 100, "progress is 100");

    // ── 10. Worker: update on terminal job ──
    console.log("10. Worker: update on completed job");
    const terminalRes = await workerPost(jobA.id, { progress: 50 });
    assert(terminalRes.status === 409, "terminal job → 409");

    // ── 11. Worker: invalid stage ──
    console.log("11. Worker: invalid stage value");
    // Create a fresh job for this test
    // First need to allow it since jobA is complete
    const { data: jobC } = await db
      .from("jobs")
      .insert({
        session_id: sessionA.id,
        org_id: userA.orgId,
        created_by: userA.userId,
        note_type: "dap",
      })
      .select("id")
      .single();
    const badStageRes = await workerPost(jobC.id, { stage: "NONSENSE" });
    assert(badStageRes.status === 422, "invalid stage → 422");

    // ── 12. Worker: out-of-range progress ──
    console.log("12. Worker: progress out of range");
    const badProgRes = await workerPost(jobC.id, { progress: 150 });
    assert(badProgRes.status === 422, "progress 150 → 422");
    const negProgRes = await workerPost(jobC.id, { progress: -1 });
    assert(negProgRes.status === 422, "progress -1 → 422");

    // ── 13. Polling reflects worker updates ──
    console.log("13. Polling reflects worker state");
    await workerPost(jobC.id, { status: "running", stage: "transcribing", progress: 30 });
    const pollRes = await fetch(`${BASE}/api/jobs/${jobC.id}`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(pollRes.status === 200, "poll returns 200");
    const pollBody = await pollRes.json();
    assert(pollBody.status === "running", "poll shows running");
    assert(pollBody.progress === 30, "poll shows progress 30");
    assert(pollBody.stage === "transcribing", "poll shows transcribing");

    // Clean up jobC
    await workerPost(jobC.id, { status: "complete", stage: "complete", progress: 100 });

    // ── 14. Session detail page reflects updated state ──
    console.log("14. Session detail reflects job updates");
    const detailRes = await fetch(`${BASE}/sessions/${sessionA.id}`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(detailRes.status === 200, "session detail loads");
    const html = await detailRes.text();
    assert(html.includes("complete"), "page shows completed status");
  } finally {
    await cleanup(
      [userA.userId, userB.userId],
      [userA.orgId, userB.orgId],
      sessionIds,
    );
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
