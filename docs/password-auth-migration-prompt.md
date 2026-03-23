# Implementation Prompt: Password Auth Migration (Final)

## Context

Clinic Notes AI currently uses Supabase magic link for authentication.
Magic link has caused recurring beta-blocking bugs. This migration
replaces magic link with email + password while preserving the existing
custom JWT session layer.

Read AGENTS.md first. Gate command: `pnpm lint && pnpm typecheck && pnpm test`

## Architecture Rules

1. `signInWithPassword` returns a Supabase session directly to the
   browser — NOT through a server callback. A server session-exchange
   endpoint must accept the Supabase access token and mint `cna_session`.

2. `supabase.auth.updateUser({ password })` requires an active
   browser-side Supabase session. Invite/reset links MUST NOT be
   consumed server-side. They must land on a browser page that
   establishes the Supabase session client-side.

3. `cna_session` MUST NOT be minted before password setup completes.
   Middleware only checks the app cookie. Minting before password set
   would let invited users into the app without credentials.

4. The callback route becomes a compatibility redirect ONLY. It does
   NOT consume auth material server-side. All auth params are forwarded
   to /set-password so the browser can establish the Supabase session.

## Architecture Summary

```
/api/auth/session (NEW) — the ONLY server-side app-cookie mint path
/login            — email + password sign-in, then token exchange
/set-password     — invite/reset session establishment + password set
/api/auth/callback — compatibility shim for old links (redirect only)
```

## Flow 1: Normal Password Login

```
Browser                           Server                        Supabase
  |                                 |                              |
  |-- signInWithPassword(email, pw) -------------------------------->
  |<---------------------------------- { access_token, user } ------|
  |                                 |                              |
  |-- POST /api/auth/session ------>|                              |
  |   { access_token }              |                              |
  |                                 |-- auth.getUser(token) ------>|
  |                                 |<-- { user } ----------------|
  |                                 |-- resolveUserProfile(user)   |
  |                                 |-- createSessionCookie(...)   |
  |<-- Set-Cookie: cna_session -----|                              |
  |-- redirect to /sessions         |                              |
```

## Flow 2: Invite Acceptance

```
1. Admin sends invite from /admin
2. inviteUserByEmail(email, { redirectTo: appUrl() + '/set-password' })
3. Supabase sends invite email with link
4. User clicks link → browser navigates to /set-password with auth
   params (hash fragment or query params depending on Supabase version)
5. /set-password creates Supabase client with persistSession: true
6. Page calls getSession() immediately AND subscribes to onAuthStateChange
   (getSession catches sessions already parsed from URL; onAuthStateChange
   catches late-arriving sessions — both are needed for robustness)
7. User enters new password + confirm
8. Client calls supabase.auth.updateUser({ password })
9. Client reads access_token from active Supabase session
10. Client POSTs access_token to /api/auth/session
11. Server verifies, provisions from invite, mints cna_session
12. Client redirects to /sessions
```

## Flow 3: Password Reset

```
1. User clicks "Forgot password?" on login page
2. Browser calls supabase.auth.resetPasswordForEmail(email, {
     redirectTo: appUrl() + '/set-password'  (client uses window.location.origin)
   })
3. Supabase sends reset email
4. User clicks link → browser navigates to /set-password with auth params
5. Same as invite flow steps 5-12
```

## Implementation Order — Six Steps

Execute in order. Run gate after each step.

### Step 1: Add appUrl getter + extract provisioning helper

**Modify `src/lib/config.ts`**
Add typed app URL getter after the existing auth section:
```typescript
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}
```

**Create `src/lib/auth/provisioning.ts`**
Extract `resolveUserProfile` and its types from `src/app/api/auth/callback/route.ts`:
- Move `resolveUserProfile` function
- Move `ProvisioningErrorCode` type
- Export both
- The function uses `createServiceClient`, `isDevLoginAllowed`, and
  `SessionRole` — keep those imports
- Update `callback/route.ts` to import from the new location

Run gate. Zero behavior change.

### Step 2: Add /api/auth/session endpoint

**Create `src/app/api/auth/session/route.ts`**
This is the ONLY server path that mints `cna_session`.
```
POST /api/auth/session
Body: { "access_token": "<supabase-access-token>" }
```

Implementation:
- Parse body, validate `access_token` is a non-empty string → 400 if missing
- Create Supabase client (same pattern as callback: `createClient` with
  `persistSession: false`)
- Call `supabase.auth.getUser(access_token)` → 401 if invalid/expired
- Call `resolveUserProfile(user)` from `src/lib/auth/provisioning.ts`
- If `errorCode === "no_invite"` → `{ error: "no_invite" }` status 403
- If `errorCode === "bootstrap_failed"` → status 500
- Call `createSessionCookie({ sub, email, practiceId: orgId, role })`
- Append Set-Cookie header to response
- Write `auth.login` audit event (void, fire-and-forget):
  `{ orgId, actorId: user.id, action: "auth.login" }`
- Rate-limited with `authLimit`
- Return `{ ok: true }` status 200

Import `withLogging` wrapper, same as other routes.

**Create `src/tests/api/auth-session.test.ts`**
Test cases:
- Valid access token → 200 + response has Set-Cookie header
- Invalid access token → 401
- Missing access_token field → 400
- No profile + no unused invite → 403 with `no_invite` error
- Rate limit hit → 429
- Successful login writes `auth.login` audit event

Mock pattern: follow `src/tests/api/auth-callback.test.ts`.
Mock `resolveUserProfile` from its new location in provisioning.ts.
Mock `createSessionCookie`, `writeAuditLog`, `checkRateLimit`.

Run gate.

### Step 3: Replace magic link login with password login

**Modify `src/app/login/LoginPageClient.tsx`**

Replace the form:
- Add password `<input type="password">` field below email
- Replace `signInWithOtp` with `signInWithPassword`:
  ```typescript
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  ```
- After successful sign-in, exchange token for app cookie:
  ```typescript
  const sessionResponse = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: data.session.access_token }),
  });
  if (sessionResponse.ok) {
    window.location.replace('/sessions');
  }
  ```
- Error handling: show generic "Invalid email or password" for ALL
  auth errors. Do NOT distinguish between wrong password and
  nonexistent email.
- Add "Forgot password?" link below the form:
  ```typescript
  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/set-password',
    });
    if (!error) setResetSent(true);
  };
  ```
- Add `resetSent` state → show "Check your email for a password reset link"
- Remove the old `sent` state (magic link sent confirmation)
- Button text: "Sign in" (not "Email me a sign-in link")
- Keep `persistSession: false` on the Supabase client
- Keep CareLogic-aligned styling (colors, spacing, fonts)

**Modify `src/app/login/page.tsx`**
- Add error message: `password_set: "Password set successfully. Sign in below."`
- Keep existing error messages for backward compat

Run gate.

### Step 4: Build /set-password page

**Create `src/app/set-password/SetPasswordClient.tsx`**

This page handles THREE entry points:
A) New invite/reset links with hash-based auth params (#access_token=...)
B) Old in-flight links redirected from callback shim (?token_hash=...&type=...)
C) Direct navigation (no session → show error)

CRITICAL SESSION ESTABLISHMENT REQUIREMENT:
The page MUST use ALL of these on mount, in this order:
1. Create Supabase client with `persistSession: true`
2. Call `supabase.auth.getSession()` immediately — catches sessions
   already parsed from the URL hash before the listener attached.
   Without this, the page has a timing bug: the Supabase client may
   finish processing the URL hash before onAuthStateChange subscribes.
3. Subscribe to `supabase.auth.onAuthStateChange(...)` as a fallback
   for sessions that arrive after mount.
4. If neither produces a session AND `token_hash` + `type` exist in
   URL search params (old links via callback shim), call
   `supabase.auth.verifyOtp({ token_hash, type })`, then re-read
   session with `getSession()`.
5. If no session after all paths, show error with link to /login.

The code sample below implements this pattern:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// persistSession: true — this is the ONE place in the app that needs
// a browser-side Supabase session for updateUser({ password })
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true },
});
```

On mount:
```typescript
useEffect(() => {
  // 1. Try getSession first — catches sessions already parsed from URL hash
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      setSession(data.session);
      setLoading(false);
      return;
    }

    // 2. Check for old-style query params (from callback compatibility shim)
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any })
        .then(({ data: otpData, error }) => {
          if (otpData?.session) setSession(otpData.session);
          else setError("Invalid or expired link. Please request a new one.");
          setLoading(false);
        });
      return;
    }

    // 3. No session found by either method
    setError("No active session. Please use a valid invite or reset link.");
    setLoading(false);
  });

  // 4. Also subscribe to onAuthStateChange for late-arriving sessions
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, newSession) => {
      if (newSession && !session) {
        setSession(newSession);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

On password submit:
```typescript
const handleSubmit = async () => {
  if (password !== confirmPassword) {
    setError("Passwords do not match");
    return;
  }
  if (password.length < 8) {
    setError("Password must be at least 8 characters");
    return;
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    setError(updateError.message);
    return;
  }

  // Exchange for app cookie
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    setError("Session lost. Please try again.");
    return;
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: currentSession.access_token }),
  });

  if (response.ok) {
    window.location.replace("/sessions");
  } else {
    setError("Failed to complete sign-in. Please try logging in.");
    window.location.replace("/login?error=password_set");
  }
};
```

UI states:
- Loading: "Setting up your account..."
- Error (no session): show error + link to /login
- Ready: password + confirm password fields + "Set Password" button
- Success: redirect to /sessions (or /login with password_set message)

Style with CareLogic design tokens (same as login page).

**Create `src/app/set-password/page.tsx`**
```typescript
import { SetPasswordClient } from "./SetPasswordClient";
export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
```

Run gate.

### Step 5: Update invite route and callback

**Modify `src/app/api/admin/invites/route.ts`**
- Import `appUrl` from `@/lib/config`
- Add `redirectTo` to `inviteUserByEmail`:
  ```typescript
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: appUrl() + '/set-password' },
  );
  ```

**Modify `src/app/api/auth/callback/route.ts`**
Reduce to a compatibility redirect shim:
- Remove `renderImplicitBridge` function entirely
- Remove POST handler entirely
- Remove `createAppRedirectResponse` function
- Remove `getSupabaseClient` function (no longer consuming tokens server-side)
- Remove all Supabase auth imports (exchangeCodeForSession, verifyOtp)
- `resolveUserProfile` is already extracted to provisioning.ts

Replace GET handler with:
```typescript
export const GET = withLogging(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  // Compatibility redirect: forward all auth params to /set-password
  // so the browser can establish the Supabase session client-side
  const target = new URL("/set-password", request.url);
  for (const [key, value] of searchParams.entries()) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 303);
});
```

This handles:
- Old invite links with `token_hash` + `type` → /set-password handles via verifyOtp
- Old magic links with `code` → /set-password won't find a session, shows error
  with link to /login (acceptable degradation for in-flight links)
- Any other params → forwarded transparently

**Modify `src/tests/api/auth-callback.test.ts`**
- Remove ALL POST handler tests
- Remove tests for code exchange and OTP verification
- Add tests for redirect behavior:
  - GET with token_hash + type → 303 redirect to /set-password with params preserved
  - GET with code param → 303 redirect to /set-password
  - GET with no params → 303 redirect to /set-password

Run gate.

### Step 6: Cleanup and final verification

- Remove dead imports from modified files
- Verify callback/route.ts has no remaining Supabase auth client usage
- Verify `resolveUserProfile` is only imported from provisioning.ts
- Optional: update trigger/route.ts and runner/route.ts to use `appUrl()`
  instead of reading `process.env.NEXT_PUBLIC_APP_URL` directly
  (can be a separate PR if you prefer)
- Run full gate one final time

## Supabase Dashboard Configuration (Manual After Deploy)

1. Authentication > Providers > Email: verify enabled
2. Authentication > URL Configuration > Redirect URLs:
   add `https://clinic-notes-ai.vercel.app/set-password`
3. Optionally disable "Magic Link" after all users have passwords

## Existing User Migration (Manual After Deploy)

- Brian: Supabase dashboard → Send password recovery → set password
- Gillian: send fresh invite from /admin → clicks link → /set-password → done
- Do NOT disable magic link until all users confirm password login works

## Files Created
1. `src/lib/auth/provisioning.ts`
2. `src/app/api/auth/session/route.ts`
3. `src/app/set-password/page.tsx`
4. `src/app/set-password/SetPasswordClient.tsx`
5. `src/tests/api/auth-session.test.ts`

## Files Modified
1. `src/lib/config.ts`
2. `src/app/login/LoginPageClient.tsx`
3. `src/app/login/page.tsx`
4. `src/app/api/admin/invites/route.ts`
5. `src/app/api/auth/callback/route.ts`
6. `src/tests/api/auth-callback.test.ts`

## Files NOT Modified
- `src/lib/auth/session.ts` — custom JWT stays
- `src/lib/auth/types.ts` — session types stay
- `src/lib/auth/claims.ts` — practiceId translation stays
- `src/lib/auth/loader.ts` — DB-backed loader stays
- `src/lib/auth/revocation.ts` — JTI revocation stays
- `src/middleware.ts` — reads cna_session cookie, unchanged
- `src/app/api/auth/logout/route.ts` — already correct
- `src/app/api/auth/dev-login/route.ts` — separate path
- No database migrations

## Acceptance Criteria
- [ ] `pnpm lint && pnpm typecheck && pnpm test` passes
- [ ] Email + password login works end-to-end
- [ ] Wrong credentials → generic "Invalid email or password"
- [ ] Invite flow: admin invites → click link → /set-password →
      set password → app cookie minted → /sessions
- [ ] Password reset: forgot password → click link → /set-password →
      set new password → app cookie minted → /sessions
- [ ] Old in-flight links with token_hash params still work via
      callback shim → /set-password with verifyOtp
- [ ] cna_session is NOT minted before password is set
- [ ] auth.login audit event fires on session exchange
- [ ] Implicit bridge HTML is gone
- [ ] Callback POST handler is gone
- [ ] /set-password uses getSession() immediately on mount + onAuthStateChange as fallback (BOTH required, not just one)
- [ ] /set-password handles old token_hash query params via verifyOtp fallback
- [ ] /set-password shows clear error if no session can be established
