"use client";

export default function ReceptionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6">
        <h1 className="text-lg font-semibold text-sky-900">Could not load reception page</h1>
        <p className="mt-2 text-sm text-sky-800">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
