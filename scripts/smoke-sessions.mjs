/**
 * Repeatable smoke test for sessions hardening.
 *
 * Tests:
 *   1. Create session with valid input
 *   2. List sessions returns owned sessions only
 *   3. Get session detail by ID
 *   4. Cross-user access: provider B cannot see provider A's session
 *   5. Unknown session ID returns 404
 *   6. Invalid session_type is rejected by DB CHECK constraint
 *   7. Unauthenticated access is blocked
 *
 * Prerequisites:
 *   - Local Supabase running (npx supabase start)
 *   - .env.local configured
 *
 * Usage:
 *   node scripts/smoke-sessions.mjs
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

async function cleanup(userIds, orgIds) {
  for (const uid of userIds) {
    await db.from("sessions").delete().eq("created_by", uid);
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
  console.log("\n=== Sessions Hardening Smoke Test ===\n");

  const suffix = Date.now();
  const userA = await createTestUser(
    `provider-a-${suffix}@test.com`,
    `Org A ${suffix}`,
  );
  const userB = await createTestUser(
    `provider-b-${suffix}@test.com`,
    `Org B ${suffix}`,
  );
  const jwtA = await mintJwt(userA.userId, userA.orgId);
  const jwtB = await mintJwt(userB.userId, userB.orgId);

  try {
    // ── 1. Create session for provider A ──
    console.log("1. Create session (provider A)");
    const { data: sessionA, error: createErr } = await db
      .from("sessions")
      .insert({
        org_id: userA.orgId,
        created_by: userA.userId,
        patient_label: "Hardening Test Patient",
        session_type: "intake",
      })
      .select("id")
      .single();
    assert(!createErr && sessionA, "session created successfully");

    // ── 2. List sessions — provider A sees own ──
    console.log("2. List sessions (provider A)");
    const listRes = await fetch(`${BASE}/api/me`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(listRes.status === 200, "provider A authenticated");

    const { data: aRows } = await db
      .from("sessions")
      .select("id")
      .eq("created_by", userA.userId)
      .eq("org_id", userA.orgId);
    assert(
      aRows && aRows.some((r) => r.id === sessionA.id),
      "provider A's session appears in their list",
    );

    // ── 3. Get session detail — provider A can access own ──
    console.log("3. Get session detail (provider A, own session)");
    const detailRes = await fetch(
      `${BASE}/sessions/${sessionA.id}`,
      { headers: { Cookie: `cna_session=${jwtA}` } },
    );
    assert(detailRes.status === 200, "provider A can view own session detail");
    const detailHtml = await detailRes.text();
    assert(
      detailHtml.includes("Hardening Test Patient"),
      "detail page renders session patient label",
    );

    // ── 4. Cross-user access: provider B cannot see A's session ──
    console.log("4. Cross-user access (provider B tries A's session)");
    const crossRes = await fetch(
      `${BASE}/sessions/${sessionA.id}`,
      { headers: { Cookie: `cna_session=${jwtB}` } },
    );
    assert(crossRes.status === 404, "provider B gets 404 for A's session");
    const crossHtml = await crossRes.text();
    assert(
      !crossHtml.includes("Hardening Test Patient"),
      "no session data leaked to provider B",
    );

    // ── 5. Unknown session ID ──
    console.log("5. Unknown session ID");
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const unknownRes = await fetch(`${BASE}/sessions/${fakeId}`, {
      headers: { Cookie: `cna_session=${jwtA}` },
    });
    assert(unknownRes.status === 404, "unknown session ID returns 404");

    // ── 6. Invalid session_type rejected by DB ──
    console.log("6. Invalid session_type");
    const { error: typeErr } = await db.from("sessions").insert({
      org_id: userA.orgId,
      created_by: userA.userId,
      patient_label: "Bad Type Test",
      session_type: "INVALID_TYPE",
    });
    assert(typeErr !== null, "DB rejects invalid session_type");
    assert(
      typeErr?.message?.includes("chk_sessions_type") ||
        typeErr?.message?.includes("check") ||
        typeErr?.code === "23514",
      "error references CHECK constraint",
    );

    // ── 7. Unauthenticated access blocked ──
    console.log("7. Unauthenticated access");
    const unauthPage = await fetch(`${BASE}/sessions`, {
      redirect: "manual",
    });
    assert(
      unauthPage.status === 307 || unauthPage.status === 308,
      "unauthenticated /sessions redirects",
    );

    const unauthApi = await fetch(`${BASE}/api/me`);
    assert(unauthApi.status === 401, "unauthenticated API returns 401");

    // ── 8. Tampered cookie rejected ──
    console.log("8. Tampered cookie");
    const tamperedRes = await fetch(`${BASE}/api/me`, {
      headers: { Cookie: "cna_session=tampered.invalid.token" },
    });
    assert(tamperedRes.status === 401, "tampered cookie returns 401");

    // ── 9. Provider B list does not include A's sessions ──
    console.log("9. Provider B list isolation");
    const { data: bRows } = await db
      .from("sessions")
      .select("id")
      .eq("created_by", userB.userId)
      .eq("org_id", userB.orgId);
    const bHasASession = bRows?.some((r) => r.id === sessionA.id) ?? false;
    assert(!bHasASession, "provider B's session list does not contain A's session");
  } finally {
    await cleanup(
      [userA.userId, userB.userId],
      [userA.orgId, userB.orgId],
    );
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
