/**
 * Mapping layer between JWT claims and database columns.
 *
 * The JWT uses `practiceId` (inherited from predecessor project).
 * The database uses `org_id` (normalized naming for new schema).
 *
 * This module is the single place where that translation happens.
 * All server-side code should resolve org identity through here
 * instead of reading session.practiceId directly for DB queries.
 *
 * When the naming mismatch is formally resolved (D013 candidate),
 * changes are isolated to this file.
 */

import type { SessionPayload, SessionRole } from "./types";

export type SessionUser = {
  userId: string;
  email: string | undefined;
  orgId: string;
  role: SessionRole;
  jti: string | undefined;
};

export const toSessionUser = (session: SessionPayload): SessionUser => ({
  userId: session.sub,
  orgId: session.practiceId,
  email: session.email,
  role: session.role,
  jti: session.jti,
});

export const resolveOrgId = (session: SessionPayload): string =>
  session.practiceId;

export const isAdmin = (user: SessionUser): boolean => user.role === "admin";
export const isProvider = (user: SessionUser): boolean =>
  user.role === "provider";
