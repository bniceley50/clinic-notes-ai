/**
 * Session cookie create / read / clear.
 *
 * Two-layer auth design (see SECURITY.md):
 *   1. Supabase Auth magic link verifies identity (D006)
 *   2. This module mints a custom HS256 JWT with app-specific
 *      claims (practiceId, role, jti) and stores it as an
 *      httpOnly cookie.
 *
 * TODO: Implement full session logic during auth milestone.
 * This file currently exports only the type re-exports and
 * the cookie name constant so other modules can reference them
 * without circular imports.
 */

export { type SessionInput, type SessionPayload, type SessionRole } from "./types";

export const SESSION_COOKIE_NAME = "cna_session";

// TODO: createSessionCookie() — mint JWT, serialize cookie
// TODO: clearSessionCookie() — expire cookie
// TODO: readSessionFromCookieHeader() — parse + verify JWT
// TODO: readSessionFromBearerHeader() — for mobile clients
// TODO: readSessionFromRequest() — cookie-first, bearer fallback
// TODO: revokeSessionJti() — JTI-based logout revocation
