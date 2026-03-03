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
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } from "@/lib/config";

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
