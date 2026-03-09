/**
 * JTI revocation store.
 *
 * Uses Upstash Redis to maintain a blocklist of revoked session
 * JTI claims. Keys are set with a TTL matching the session lifetime
 * so the store self-cleans.
 *
 * Graceful fallback: if Redis is unavailable, revocation checks
 * pass through (allow) rather than hard-failing all requests.
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
 * No-op if Redis is not configured or jti is missing.
 */
export async function revokeSession(
  jti: string | undefined,
  ttlSeconds: number
): Promise<void> {
  if (!redisAvailable || !jti) return;
  try {
    await redisCommand(["SET", `${REVOKED_PREFIX}${jti}`, "1", "EX", ttlSeconds]);
  } catch {
    // Non-fatal — logout still clears the cookie
  }
}

/**
 * Returns true if the JTI has been revoked.
 * Returns false on any error or if Redis is not configured.
 */
export async function isSessionRevoked(
  jti: string | undefined
): Promise<boolean> {
  if (!redisAvailable || !jti) return false;
  try {
    const result = await redisCommand(["EXISTS", `${REVOKED_PREFIX}${jti}`]);
    return result === 1;
  } catch {
    // Fail open — do not block requests if Redis is down
    return false;
  }
}