"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function LoginPage() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        setError("Supabase is not configured. Check your environment variables.");
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  /* ── Magic link sent — confirmation screen ───────────── */
  if (sent) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center"
        style={{ backgroundColor: "#F9F9F9" }}
      >
        {/* CareLogic-style top banner */}
        <div
          className="fixed top-0 left-0 right-0 flex items-center px-4"
          style={{ height: "32px", backgroundColor: "#3B276A", color: "#ffffff" }}
        >
          <span className="text-xs font-semibold tracking-wide">Clinic Notes AI</span>
        </div>

        <div className="card-ql w-full max-w-sm p-8 mt-8 space-y-4">
          <div
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: "#517AB7" }}
          >
            Check your email
          </div>
          <p className="text-sm" style={{ color: "#333333" }}>
            We sent a magic link to <strong>{email}</strong>.
            Click the link in your email to sign in.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(""); }}
            className="text-sm"
            style={{ color: "#517AB7" }}
          >
            ← Use a different email
          </button>
        </div>
      </main>
    );
  }

  /* ── Login form ──────────────────────────────────────── */
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: "#F9F9F9" }}
    >
      {/* CareLogic-style top banner */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center px-4"
        style={{ height: "32px", backgroundColor: "#3B276A", color: "#ffffff" }}
      >
        <span className="text-xs font-semibold tracking-wide">Clinic Notes AI</span>
      </div>

      <div className="card-ql w-full max-w-sm p-8 mt-8 space-y-6">
        {/* Logo / brand mark */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: "#3B276A" }}
          >
            CN
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#3B276A" }}>
              Clinic Notes AI
            </p>
            <p className="text-xs" style={{ color: "#777777" }}>
              Clinical documentation companion
            </p>
          </div>
        </div>

        <div
          className="border-t text-xs font-bold uppercase tracking-wider pt-4"
          style={{ borderColor: "#E7E9EC", color: "#517AB7" }}
        >
          Sign In
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold mb-1 uppercase tracking-wider"
              style={{ color: "#517AB7" }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              className="input-ql"
            />
          </div>

          {error && (
            <p className="text-sm font-medium" style={{ color: "#CC2200" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="btn-ql w-full justify-center"
          >
            {loading ? "Sending…" : "Send Magic Link"}
          </button>
        </form>

        <p className="text-[11px] text-center" style={{ color: "#777777" }}>
          A sign-in link will be sent to your email address.
        </p>
      </div>
    </main>
  );
}
