"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">Could not load admin page</h1>
        <p className="mt-2 text-sm text-red-800">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
