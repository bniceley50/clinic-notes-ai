"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Footer } from "@/components/layout/Footer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function LoginPageClient({
  callbackErrorMessage,
}: {
  callbackErrorMessage: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function getSupabaseClient() {
    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Supabase is not configured. Check your environment variables.");
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.session?.access_token) {
        setError("Invalid email or password");
        return;
      }

      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: data.session.access_token }),
      });

      if (!sessionResponse.ok) {
        let message = "Sign-in failed. Please try again.";
        try {
          const body = (await sessionResponse.json()) as { error?: string };
          if (body.error === "no_invite") {
            message = "Your email hasn't been invited yet. Contact your administrator.";
          } else if (body.error === "bootstrap_failed") {
            message = "Account setup failed. Please try again or contact support.";
          }
        } catch {
          // Fall back to the default message when the error body cannot be parsed.
        }
        setError(message);
        return;
      }

      window.location.replace("/sessions");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetSent(false);

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });

      if (resetError) {
        setError("Failed to send password reset email. Please try again.");
        return;
      }

      setResetSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-nav-bg">
      <div className="fixed top-0 left-0 right-0 z-10 flex h-[32px] items-center bg-primary px-4 text-white">
        <span className="text-xs font-semibold tracking-wide">Clinic Notes AI</span>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="card-ql w-full max-w-sm p-8 mt-8 space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold bg-primary"
            >
              CN
            </div>
            <div>
              <p className="text-sm font-bold text-primary">
                Structured documentation for behavioral health
              </p>
              <p className="text-xs text-text-muted">
                Review transcripts, extract EHR-ready fields, and optionally draft notes for clinician review.
              </p>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4 text-xs font-bold uppercase tracking-wider text-accent">
            Sign In
          </div>

          {callbackErrorMessage && !error && (
            <div
              role="alert"
              className="rounded border border-[#E7B8AF] bg-[#FFF1ED] px-3 py-2 text-sm font-medium text-[#8A1F11]"
            >
              {callbackErrorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold mb-1 uppercase tracking-wider text-accent"
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

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold mb-1 uppercase tracking-wider text-accent"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-ql"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-alert">
                {error}
              </p>
            )}

            {resetSent && !error && (
              <p className="text-sm font-medium text-accent">
                Check your email for a password reset link.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-ql w-full justify-center"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading || !email}
              className="w-full text-sm text-accent"
            >
              Forgot password?
            </button>
          </form>

          <p className="text-[11px] text-center text-text-muted">
            Sign in with your email and password to access your session workspace.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
