// src/lib/rate-limit.ts
// Upstash rate limiting for Clinic Notes AI
//
// Required env vars (add to .env.local AND Vercel dashboard):
//   UPSTASH_REDIS_REST_URL=
//   UPSTASH_REDIS_REST_TOKEN=

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { validateRedisRateLimitConfig } from "@/lib/config";

validateRedisRateLimitConfig();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisAvailable = Boolean(redisUrl && redisToken);

const redis = redisAvailable
  ? new Redis({ url: redisUrl!, token: redisToken! })
  : null;

// AI note generation - 20 requests/hour per user
export const generateNoteLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h"), analytics: true, prefix: "ratelimit:generate" })
  : null;

// Auth endpoints - 10 requests per 15 minutes
export const authLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), analytics: true, prefix: "ratelimit:auth" })
  : null;

// EHR field regeneration - 5 requests per hour per user
export const ehrRegenerateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: true,
      prefix: "ratelimit:ehr-regenerate",
    })
  : null;

// Consent endpoint - 10 requests per hour per user
export const consentLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), analytics: true, prefix: "consent" })
  : null;

// General API - 200 requests/hour
export const apiLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "1 h"), analytics: true, prefix: "ratelimit:api" })
  : null;

export function getIdentifier(
  request: Request,
  userId?: string | null
): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<Response | null> {
  if (!limiter) return null; // Redis not configured - pass through
  const { success, limit, reset, remaining } = await limiter.limit(identifier);
  if (!success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please wait before trying again.",
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  return null;
}
