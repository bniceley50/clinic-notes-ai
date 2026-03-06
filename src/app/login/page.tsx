"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
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

  if (sent) {
    return (
      <main className="ql-login-page">
        <div className="ql-login-shell">
          <div className="ql-login-brand">CLINIC NOTES AI</div>
          <div className="ql-login-hero">Secure Sign In</div>

          <section className="ql-login-card">
            <p className="ql-kicker">Clinic access</p>
            <h1 className="ql-panel-title">Check your email</h1>
            <p className="ql-subtitle">
              We sent a magic link to <strong>{email}</strong>. Open the message
              and follow the sign-in link.
            </p>

            <div className="ql-toolbar" style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="ql-button-secondary"
              >
                Use a different email
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="ql-login-page">
      <div className="ql-login-shell">
        <div className="ql-login-brand">CLINIC NOTES AI</div>
        <div className="ql-login-hero">Secure Sign In</div>

        <section className="ql-login-card">
          <p className="ql-kicker">Clinic Notes AI</p>
          <h1 className="ql-panel-title">Clinic Notes AI Login</h1>
          <p className="ql-subtitle">
            Sign in with your organization email to receive a secure magic link.
          </p>

          <form onSubmit={handleSubmit} className="ql-grid" style={{ marginTop: 14 }}>
            <div className="ql-field">
              <label htmlFor="email" className="ql-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.example.com"
                className="ql-input"
              />
            </div>

            {error ? (
              <div className="ql-alert ql-alert-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="ql-toolbar">
              <button
                type="submit"
                disabled={loading || !email}
                className="ql-button ql-button-orange"
              >
                {loading ? "Sending..." : "LOGIN"}
              </button>
              <span className="ql-subtitle">
                SOURCE: CLINIC NOTES AI | AI-GENERATED - REVIEW REQUIRED
              </span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
