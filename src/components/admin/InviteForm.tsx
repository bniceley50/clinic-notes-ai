"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteRole = "provider" | "admin";

type InviteResponse = { ok: boolean; error?: string };

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("provider");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          email,
          role,
        }),
      });

      const payload = (await response.json().catch(() => null)) as InviteResponse | null;

      if (!response.ok) {
        setError(payload?.error ?? "Failed to send invite");
        return;
      }

      setSuccess(`Invite sent to ${email}`);
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
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="invite-role">Role</label>
        <select
          id="invite-role"
          value={role}
          onChange={(event) => setRole(event.target.value as InviteRole)}
        >
          <option value="provider">Provider</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error ? <p>{error}</p> : null}
      {success ? <p>{success}</p> : null}

      <button type="submit" disabled={loading || !email.trim()}>
        {loading ? "Sending..." : "Send Invite"}
      </button>
    </form>
  );
}
