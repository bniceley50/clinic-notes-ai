"use client";

import React, { useEffect, useState } from "react";
import {
  createClient,
  type EmailOtpType,
  type Session,
} from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function isSupportedOtpType(value: string): value is EmailOtpType {
  return value === "invite" || value === "recovery";
}

export function SetPasswordClient() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [supabase] = useState(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  });

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.");
      setLoading(false);
      return;
    }

    let active = true;

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active || !nextSession) {
        return;
      }

      setSession((currentSession) => currentSession ?? nextSession);
      setError(null);
      setLoading(false);
    });

    void (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (initialSession) {
        setSession(initialSession);
        setError(null);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type && isSupportedOtpType(type)) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (!active) {
          return;
        }

        if (otpError) {
          setError("Invalid or expired link. Please request a new one.");
          setLoading(false);
          return;
        }

        const {
          data: { session: verifiedSession },
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (verifiedSession) {
          setSession(verifiedSession);
          setError(null);
          setLoading(false);
          return;
        }
      }

      setError("No active session. Please use a valid invite or reset link.");
      setLoading(false);
    })();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase || !session) {
      setError("No active session. Please use a valid invite or reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        window.location.replace("/login?error=password_set");
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: currentSession.access_token }),
      });

      if (response.ok) {
        window.location.replace("/sessions");
        return;
      }

      window.location.replace("/login?error=password_set");
    } catch {
      setError("Failed to complete sign-in. Please try logging in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-nav-bg"
    >
      <div className="fixed top-0 left-0 right-0 flex h-[32px] items-center bg-primary px-4 text-white">
        <span className="text-xs font-semibold tracking-wide">Clinic Notes AI</span>
      </div>

      <div className="card-ql w-full max-w-sm p-8 mt-8 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold bg-primary"
          >
            CN
          </div>
          <div>
            <p className="text-sm font-bold text-primary">
              Set your password
            </p>
            <p className="text-xs text-text-muted">
              Finish account setup so you can sign in normally with email and password.
            </p>
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4 text-xs font-bold uppercase tracking-wider text-accent">
          Password Setup
        </div>

        {loading ? (
          <p className="text-sm text-text-body">
            Setting up your account...
          </p>
        ) : session ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold mb-1 uppercase tracking-wider text-accent"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                className="input-ql"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold mb-1 uppercase tracking-wider text-accent"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                className="input-ql"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !password || !confirmPassword}
              className="btn-ql w-full justify-center"
            >
              {submitting ? "Saving..." : "Set Password"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-alert">
              {error ?? "No active session. Please use a valid invite or reset link."}
            </p>
            <a href="/login" className="text-sm text-accent">
              Return to sign in
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
