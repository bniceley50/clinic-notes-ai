/**
 * Session cookie create / read / clear.
 *
 * Two-layer auth design (see SECURITY.md):
 *   1. Supabase Auth magic link verifies identity (D006)
 *   2. This module mints a custom HS256 JWT with app-specific
 *      claims (practiceId, role, jti) and stores it as an
 *      httpOnly cookie.
 *
 * Edge-runtime compatible: uses `jose` (not node:crypto) and
 * `globalThis.crypto` for UUID generation.
 *
 * JTI revocation: JWTs carry a `jti` claim that can be revoked
 * server-side via the revocation store used by logout and middleware.
 */

import { SignJWT, jwtVerify } from "jose";
import {
  authCookieSecret,
  sessionTtlSeconds,
  isProduction as envIsProduction,
} from "@/lib/config";
import type { SessionInput, SessionPayload, CookieOptions } from "./types";

export { type SessionInput, type SessionPayload, type SessionRole } from "./types";

export const SESSION_COOKIE_NAME = "cna_session";

const encoder = new TextEncoder();

const readCookieSecret = (): Uint8Array | null => {
  try {
    return encoder.encode(authCookieSecret());
  } catch {
    return null;
  }
};

const requireCookieSecret = (): Uint8Array => {
  return encoder.encode(authCookieSecret());
};

const randomJti = (): string => {
  return globalThis.crypto.randomUUID();
};

const getCookieValue = (
  cookieHeader: string | null,
  name: string,
): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const raw = rest.join("=");
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
};

const serializeCookie = (cookie: {
  name: string;
  value: string;
  options: CookieOptions;
}): string => {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Max-Age=${cookie.options.maxAge}`,
    `Path=${cookie.options.path}`,
    `SameSite=${cookie.options.sameSite}`,
  ];
  if (cookie.options.httpOnly) parts.push("HttpOnly");
  if (cookie.options.secure) parts.push("Secure");
  return parts.join("; ");
};

const toSessionPayload = (
  payload: Record<string, unknown>,
): SessionPayload | null => {
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (typeof payload.practiceId !== "string" || !payload.practiceId) return null;
  if (typeof payload.role !== "string") return null;
  if (typeof payload.iat !== "number") return null;
  if (typeof payload.exp !== "number") return null;

  const role = payload.role;
  if (role !== "provider" && role !== "admin") return null;

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    practiceId: payload.practiceId,
    role,
    iat: payload.iat,
    exp: payload.exp,
    jti: typeof payload.jti === "string" ? payload.jti : undefined,
  };
};

export const createSessionCookie = async (
  session: SessionInput,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = sessionTtlSeconds();
  const exp = now + ttl;
  const secret = requireCookieSecret();

  const token = await new SignJWT({
    sub: session.sub,
    email: session.email,
    practiceId: session.practiceId,
    role: session.role,
    jti: randomJti(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);

  return serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: envIsProduction(),
      maxAge: ttl,
    },
  });
};

export const clearSessionCookie = (): string =>
  serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: envIsProduction(),
      maxAge: 0,
    },
  });

const verifySessionJwt = async (
  token: string,
): Promise<SessionPayload | null> => {
  const secret = readCookieSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return toSessionPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
};

export const readSessionFromCookieHeader = async (
  cookieHeader: string | null,
): Promise<SessionPayload | null> => {
  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;
  return verifySessionJwt(token);
};

export const readSessionFromBearerHeader = async (
  authHeader: string | null,
): Promise<SessionPayload | null> => {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return verifySessionJwt(parts[1]);
};

export const readSessionFromRequest = async (
  request: Request,
): Promise<SessionPayload | null> => {
  const cookieSession = await readSessionFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (cookieSession) return cookieSession;
  return readSessionFromBearerHeader(request.headers.get("authorization"));
};
