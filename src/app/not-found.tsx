import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <Link
        href="/"
        className="text-sm text-neutral-500 underline hover:text-neutral-900"
      >
        Go home
      </Link>
    </div>
  );
}
