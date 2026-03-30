/**
 * JTI revocation store.
 *
 * Uses Upstash Redis to maintain a blocklist of revoked session
 * JTI claims. Keys are set with a TTL matching the session lifetime
 * so the store self-cleans.
 *
 * Read-side failure policy (isSessionRevoked): fails OPEN.
 * A Redis outage during a read allows the request through rather than
 * taking down the entire authenticated surface. This is an explicit
 * temporary tradeoff accepted pre-production — see DECISIONS.md D009.
 *
 * Write-side failure policy (revokeSession): fails HARD.
 * A Redis outage during logout propagates the error to the caller.
 * The logout route is responsible for returning 503 and NOT clearing
 * the cookie, so logout intent is never silently lost.
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisAvailable = Boolean(redisUrl && redisToken);

const REVOKED_PREFIX = "revoked:jti:";

async function redisCommand(
  command: unknown[]
): Promise<unknown> {
  const res = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = (await res.json()) as { result: unknown }[];
  return data[0]?.result;
}

/**
 * Write a revoked JTI to Redis with a TTL (seconds).
 *
 * Throws if Redis is unavailable or the write fails — callers must
 * handle the error and must NOT clear the session cookie on failure.
 *
 * No-op if jti is missing (untracked sessions cannot be explicitly revoked).
 */
export async function revokeSession(
  jti: string | undefined,
  ttlSeconds: number
): Promise<void> {
  if (!jti) return;
  if (!redisAvailable) {
    throw new Error("Revocation store unavailable");
  }
  await redisCommand(["SET", `${REVOKED_PREFIX}${jti}`, "1", "EX", ttlSeconds]);
}

/**
 * Returns true if the JTI has been revoked.
 *
 * Fails OPEN — returns false on any error or if Redis is not configured.
 * This is an explicit policy decision: a Redis outage during request
 * enforcement allows sessions through rather than causing a full
 * authenticated-app outage. See DECISIONS.md D009 for rationale and
 * the conditions under which this should be revisited.
 */
export async function isSessionRevoked(
  jti: string | undefined
): Promise<boolean> {
  if (!redisAvailable || !jti) return false;
  try {
    const result = await redisCommand(["EXISTS", `${REVOKED_PREFIX}${jti}`]);
    return result === 1;
  } catch {
    // Explicit policy: fail open. See module docblock.
    return false;
  }
}
