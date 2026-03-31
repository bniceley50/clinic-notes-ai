"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { SessionRow } from "@/lib/sessions/queries";

const SESSION_STATUS_CHIP: Record<string, string> = {
  active: "chip-running",
  completed: "chip-complete",
  archived: "chip-cancelled",
};

type SessionDeleteButtonProps = {
  sessionId: string;
  patientLabel: string | null;
  redirectTo?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function SessionDeleteButton({
  sessionId,
  patientLabel,
  redirectTo,
  className,
  style,
  children,
}: SessionDeleteButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    const label = patientLabel?.trim() || "Untitled session";
    const confirmed = window.confirm(
      `Delete session "${label}"?\n\n` +
        "This will permanently delete the session and all associated data including jobs, transcripts, notes, and audio files. This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | { deleted?: boolean }
        | null;

      if (!response.ok) {
        window.alert(
          (payload && "error" in payload && payload.error) ||
            "Failed to delete session",
        );
        return;
      }

      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }

      window.location.reload();
    } catch {
      window.alert("Failed to delete session");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={pending}
      className={className}
      style={style}
    >
      {pending ? "Deleting..." : children ?? "Delete"}
    </button>
  );
}

type SessionListProps = {
  sessions: SessionRow[];
  error: string | null;
  currentUserId: string;
  currentUserRole: string;
};

export function SessionList({
  sessions,
  error,
  currentUserId,
  currentUserRole,
}: SessionListProps) {
  return (
    <div className="mt-6 card-ql overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>Patient Label</th>
            <th>Type</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && !error && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-text-muted">
                No sessions yet. Create one above.
              </td>
            </tr>
          )}
          {sessions.map((session) => {
            const canDelete =
              currentUserRole === "admin" || session.created_by === currentUserId;

            return (
              <tr key={session.id}>
                <td className="font-medium text-text-dark">
                  {session.patient_label || "Untitled session"}
                </td>
                <td>
                  <span
                    className="inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                    style={{ backgroundColor: "#F0F0F0", color: "#333333" }}
                  >
                    {session.session_type}
                  </span>
                </td>
                <td>
                  <span
                    className={`inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      SESSION_STATUS_CHIP[session.status] ?? "chip-cancelled"
                    }`}
                  >
                    {session.status}
                  </span>
                </td>
                <td className="text-xs text-text-muted">
                  {new Date(session.created_at).toLocaleString()}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {canDelete ? (
                      <SessionDeleteButton
                        sessionId={session.id}
                        patientLabel={session.patient_label}
                        className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Delete
                      </SessionDeleteButton>
                    ) : null}
                    <Link
                      href={`/sessions/${session.id}`}
                      className="text-xs font-semibold no-underline rounded-[2px] px-3 py-1"
                      style={{
                        color: "#517AB7",
                        border: "1px solid #E7E9EC",
                      }}
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
