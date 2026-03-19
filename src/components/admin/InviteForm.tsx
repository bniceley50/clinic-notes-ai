"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteRole = "provider" | "admin";

type InviteResponse = { ok: boolean; error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("provider");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const normalizedEmail = normalizeEmail(email);
  const isValidEmail = EMAIL_PATTERN.test(normalizedEmail);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail) {
      setError("Enter a valid email address");
      setSuccess(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          role,
        }),
      });

      const payload = (await response.json().catch(() => null)) as InviteResponse | null;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError("You don't have permission to invite users");
          return;
        }

        setError(payload?.error ?? "Failed to send invite");
        return;
      }

      setSuccess(`Invite sent to ${normalizedEmail}`);
      setEmail("");
      setRole("provider");
      router.refresh();
    } catch {
      setError("Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <label htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
            if (success) setSuccess(null);
          }}
        />
      </div>

      <div>
        <label htmlFor="invite-role">Role</label>
        <select
          id="invite-role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as InviteRole);
            if (error) setError(null);
            if (success) setSuccess(null);
          }}
        >
          <option value="provider">Provider</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error ? <p>{error}</p> : null}
      {success ? <p>{success}</p> : null}

      <button type="submit" disabled={loading || !isValidEmail}>
        {loading ? "Sending..." : "Send Invite"}
      </button>
    </form>
  );
}
