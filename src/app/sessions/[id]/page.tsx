import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionDetailPage({ params }: Props) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { id } = await params;
  const { data: session, error } = await getMySession(user, id);

  if (error || !session) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/sessions"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; All Sessions
        </Link>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            session.status === "active"
              ? "bg-green-50 text-green-700"
              : session.status === "completed"
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          {session.patient_label || "Untitled session"}
        </h1>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Type</dt>
            <dd className="text-gray-900">{session.session_type}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Status</dt>
            <dd className="text-gray-900">{session.status}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Created</dt>
            <dd className="text-gray-900">
              {new Date(session.created_at).toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Last Updated</dt>
            <dd className="text-gray-900">
              {new Date(session.updated_at).toLocaleString()}
            </dd>
          </div>
          {session.completed_at && (
            <div className="flex justify-between border-b pb-2">
              <dt className="font-medium text-gray-600">Completed</dt>
              <dd className="text-gray-900">
                {new Date(session.completed_at).toLocaleString()}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Session ID</dt>
            <dd className="font-mono text-xs text-gray-500">{session.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-gray-600">Organization</dt>
            <dd className="text-gray-900">{user.org.name}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
