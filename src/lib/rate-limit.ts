// src/lib/rate-limit.ts
// Upstash rate limiting for Clinic Notes AI
//
// Required env vars (add to .env.local AND Vercel dashboard):
//   UPSTASH_REDIS_REST_URL=
//   UPSTASH_REDIS_REST_TOKEN=

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// AI note generation — 20 requests/hour per user
export const generateNoteLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  analytics: true,
  prefix: "ratelimit:generate",
});

// Auth endpoints — 10 requests per 15 minutes
export const authLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  analytics: true,
  prefix: "ratelimit:auth",
});

// General API — 200 requests/hour
export const apiLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, "1 h"),
  analytics: true,
  prefix: "ratelimit:api",
});

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
  limiter: Ratelimit,
  identifier: string
): Promise<Response | null> {
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