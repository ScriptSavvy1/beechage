export function PageSkeleton({
  rows = 6,
  title = "Loading...",
}: {
  rows?: number;
  title?: string;
}) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-zinc-200" />
      <p className="mb-8 text-sm text-zinc-500">{title}</p>
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-zinc-100" />
        ))}
      </div>
    </main>
  );
}
