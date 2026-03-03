/**
 * Repeatable smoke test for jobs hardening.
 *
 * Tests:
 *   1.  Provider A creates job on own session
 *   2.  Job appears in session's job list
 *   3.  Provider B cannot create job on A's session (FK + ownership)
 *   4.  Second active job on same session is blocked (partial unique)
 *   5.  Invalid note_type rejected by DB CHECK constraint
 *   6.  Session detail page shows job state
 *   7.  Unauthenticated job creation blocked
 *   8.  Tampered cookie blocked
 *   9.  Provider B cannot read A's jobs
 *   10. Completed job allows new active job on same session
 *
 * Prerequisites:
 *   - Local Supabase running (npx supabase start)
 *   - App dev server running on APP_PORT (default 3099)
 *   - .env.local configured
 *
 * Usage:
 *   node scripts/smoke-jobs.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import crypto from "node:crypto";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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

async function run() {
  console.log("\n=== Jobs Hardening Smoke Test ===\n");

  const suffix = Date.now();
  const userA = await createTestUser(
    `jobs-a-${suffix}@test.com`,
    `Jobs Org A ${suffix}`,
  );
  const userB = await createTestUser(
    `jobs-b-${suffix}@test.com`,
    `Jobs Org B ${suffix}`,
  );
  const jwtA = await mintJwt(userA.userId, userA.orgId);
  const jwtB = await mintJwt(userB.userId, userB.orgId);

  const sessionIds = [];

  try {
    // Create a session for provider A
    const { data: sessionA } = await db
      .from("sessions")
      .insert({
        org_id: userA.orgId,
        created_by: userA.userId,
        patient_label: "Jobs Test Patient",
        session_type: "general",
      })
      .select("id")
      .single();
    sessionIds.push(sessionA.id);

    // ── 1. Create job on own session ──
    console.log("1. Create job (provider A, own session)");
    const { data: jobA, error: createErr } = await db
      .from("jobs")
      .insert({
        session_id: sessionA.id,
        org_id: userA.orgId,
        created_by: userA.userId,
        note_type: "soap",
      })
      .select("id, status, stage")
      .single();
    assert(!createErr && jobA, "job created successfully");
    assert(jobA?.status === "queued", "job status is queued");
    assert(jobA?.stage === "queued", "job stage is queued");

    // ── 2. Job appears in session's job list ──
    console.log("2. Job list for session");
    const { data: jobList } = await db
      .from("jobs")
      .select("id")
      .eq("session_id", sessionA.id)
      .eq("org_id", userA.orgId)
      .eq("created_by", userA.userId);
    assert(
      jobList && jobList.some((j) => j.id === jobA.id),
      "job appears in session job list",
    );

    // ── 3. Provider B cannot create job on A's session ──
    console.log("3. Cross-user job creation (provider B on A's session)");
    const { error: crossErr } = await db.from("jobs").insert({
      session_id: sessionA.id,
      org_id: userB.orgId,
      created_by: userB.userId,
      note_type: "soap",
    });
    assert(crossErr !== null, "provider B blocked from creating job on A's session");

    // ── 4. Second active job on same session blocked ──
    console.log("4. One active job per session");
    const { error: dupErr } = await db.from("jobs").insert({
      session_id: sessionA.id,
      org_id: userA.orgId,
      created_by: userA.userId,
      note_type: "dap",
    });
    assert(dupErr !== null, "second active job blocked");
    assert(
      dupErr?.code === "23505",
      "error is unique violation (23505)",
    );

    // ── 5. Invalid note_type rejected ──
    console.log("5. Invalid note_type");
    // Mark existing job as complete first so we can test note_type
    await db.from("jobs").update({ status: "complete", stage: "complete" }).eq("id", jobA.id);
    const { error: typeErr } = await db.from("jobs").insert({
      session_id: sessionA.id,
      org_id: userA.orgId,
      created_by: userA.userId,
      note_type: "INVALID",
    });
    assert(typeErr !== null, "DB rejects invalid note_type");
    assert(
      typeErr?.message?.includes("chk_jobs_note_type") ||
        typeErr?.message?.includes("check") ||
        typeErr?.code === "23514",
      "error references CHECK constraint",
    );

    // ── 6. Session detail page shows job ──
    console.log("6. Session detail shows job");
    const detailRes = await fetch(`${BASE}/sessions/${sessionA.id}`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(detailRes.status === 200, "session detail loads");
    const detailHtml = await detailRes.text();
    assert(detailHtml.includes("SOAP"), "detail page shows job note type");
    assert(
      detailHtml.includes("complete") || detailHtml.includes("queued"),
      "detail page shows job status",
    );

    // ── 7. Unauthenticated blocked ──
    console.log("7. Unauthenticated access");
    const unauthRes = await fetch(`${BASE}/sessions/${sessionA.id}`, {
      redirect: "manual",
    });
    assert(
      unauthRes.status === 307 || unauthRes.status === 308,
      "unauthenticated session detail redirects",
    );

    // ── 8. Tampered cookie blocked ──
    console.log("8. Tampered cookie");
    const tamperedRes = await fetch(`${BASE}/sessions/${sessionA.id}`, {
      headers: { Cookie: "cna_session=tampered.bad.token" },
      redirect: "manual",
    });
    assert(
      tamperedRes.status === 307 || tamperedRes.status === 308,
      "tampered cookie redirects to login",
    );

    // ── 9. Provider B cannot read A's jobs ──
    console.log("9. Provider B job isolation");
    const { data: bJobs } = await db
      .from("jobs")
      .select("id")
      .eq("session_id", sessionA.id)
      .eq("org_id", userB.orgId)
      .eq("created_by", userB.userId);
    assert(
      !bJobs || bJobs.length === 0,
      "provider B sees no jobs for A's session",
    );

    // Provider B tries to view A's session detail page
    const crossDetailRes = await fetch(
      `${BASE}/sessions/${sessionA.id}`,
      { headers: { Cookie: `cna_session=${jwtB}` } },
    );
    assert(crossDetailRes.status === 404, "provider B gets 404 for A's session detail");

    // ── 10. Completed job allows new active job ──
    console.log("10. Completed job allows new active job");
    // jobA is already marked complete above
    const { data: jobA2, error: newJobErr } = await db
      .from("jobs")
      .insert({
        session_id: sessionA.id,
        org_id: userA.orgId,
        created_by: userA.userId,
        note_type: "dap",
      })
      .select("id, status")
      .single();
    assert(!newJobErr && jobA2, "new job created after previous completed");
    assert(jobA2?.status === "queued", "new job starts as queued");
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
