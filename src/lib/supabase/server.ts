import "server-only";

/**
 * Server-side Supabase clients.
 *
 * - `createServiceClient()` uses the service role key and bypasses RLS.
 *   Use only in trusted server contexts (API routes, workers, bootstrap).
 *
 * - `createAnonClient()` uses the anon key for client-scoped queries
 *   that go through RLS.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
} from "@/lib/config";

export type { SupabaseClient };

export const createServiceClient = (): SupabaseClient => {
  const serviceKey = supabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for service-role operations",
    );
  }
  return createClient(supabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const createAnonClient = (): SupabaseClient => {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * createServerClient()
 * Cookie-bound Supabase client for server components and route handlers.
 * Use this whenever you need auth.getUser() to reflect the real caller session.
 * Uses the anon key + RLS â€” does NOT bypass row-level security.
 */
export const createServerClient = async (): Promise<SupabaseClient> => {
  const cookieStore = await cookies();
  return createSSRClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll called from a Server Component â€” safe to ignore
        }
      },
    },
  });
};