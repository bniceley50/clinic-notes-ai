"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const allowDevLogin = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true";

export default function DevLoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!allowDevLogin) {
    return (
      <main>
        <p>Not available</p>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        setError("Supabase is not configured.");
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      window.location.assign("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {error ? <p>{error}</p> : null}

        <button type="submit" disabled={loading || !email}>
          {loading ? "Sending..." : "Dev Login"}
        </button>
      </form>
    </main>
  );
}
