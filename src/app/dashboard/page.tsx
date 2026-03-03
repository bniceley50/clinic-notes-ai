import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";

export default async function DashboardPage() {
  const result = await loadCurrentUser();

  if (result.status === "no_session") {
    redirect("/login");
  }

  if (result.status === "no_profile") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Profile not found
          </h1>
          <p className="text-sm text-gray-600">
            Your account exists but no profile has been created yet. An
            administrator needs to provision your access.
          </p>
          <dl className="mt-4 space-y-2 text-xs text-gray-500">
            <div className="flex gap-2">
              <dt className="font-medium">User ID:</dt>
              <dd className="font-mono">{result.userId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Org ID:</dt>
              <dd className="font-mono">{result.orgId}</dd>
            </div>
          </dl>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (result.status === "no_org") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-red-700">
            Organization not found
          </h1>
          <p className="text-sm text-gray-600">
            Your session references an organization that does not exist in the
            database. This may indicate a data integrity issue.
          </p>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (result.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-red-700">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-600">{result.message}</p>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { user } = result;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Authenticated session resolved from database
          </p>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Display Name</dt>
            <dd className="text-gray-900">{user.profile.display_name}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Role</dt>
            <dd className="text-gray-900">{user.role}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Organization</dt>
            <dd className="text-gray-900">{user.org.name}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">User ID</dt>
            <dd className="font-mono text-xs text-gray-500">{user.userId}</dd>
          </div>
          <div className="flex justify-between border-b pb-2">
            <dt className="font-medium text-gray-600">Org ID</dt>
            <dd className="font-mono text-xs text-gray-500">{user.orgId}</dd>
          </div>
          {user.email && (
            <div className="flex justify-between border-b pb-2">
              <dt className="font-medium text-gray-600">Email</dt>
              <dd className="text-gray-900">{user.email}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="font-medium text-gray-600">Member Since</dt>
            <dd className="text-gray-900">
              {new Date(user.profile.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>

        <Link
          href="/sessions"
          className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Go to Sessions
        </Link>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
