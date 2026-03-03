import "server-only";

/**
 * Server-side auth helpers for use in API routes and server components.
 *
 * These read the identity headers injected by middleware (x-user-id,
 * x-org-id, x-user-role). Only callable in server contexts after
 * middleware has verified the session.
 */

import { headers } from "next/headers";
import type { SessionRole } from "./types";
import type { SessionUser } from "./claims";

export const getCurrentUser = async (): Promise<SessionUser | null> => {
  const h = await headers();
  const userId = h.get("x-user-id");
  const orgId = h.get("x-org-id");
  const role = h.get("x-user-role") as SessionRole | null;

  if (!userId || !orgId || !role) return null;

  return { userId, orgId, role, email: undefined, jti: undefined };
};

export const requireCurrentUser = async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: no session");
  return user;
};
