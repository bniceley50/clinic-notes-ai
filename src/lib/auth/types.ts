/**
 * Auth type definitions.
 *
 * These types define the session contract for the app-minted JWT
 * (see SECURITY.md "Authentication" section). Supabase Auth handles
 * identity verification; the app then mints a custom JWT with
 * these claims.
 *
 * TODO: The claim name `practiceId` is inherited from the predecessor
 * project (ai-session-notes). The new DB schema uses `org_id` / `orgs`
 * table. Resolve this naming mismatch explicitly before session.ts
 * migration is finalized — do not silently rename. Track as a future
 * decision (D013 candidate).
 */

export type SessionRole = "provider" | "admin";

export type SessionInput = {
  sub: string;
  email?: string;
  practiceId: string;
  role: SessionRole;
};

export type SessionPayload = SessionInput & {
  iat: number;
  exp: number;
  jti?: string;
};

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  secure: boolean;
  maxAge: number;
};
