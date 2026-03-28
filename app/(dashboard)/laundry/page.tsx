import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function LaundryHomePage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Laundry</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">Welcome back</h1>
        <p className="mt-0.5 text-sm text-zinc-600">{session?.user?.email ?? ""}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/laundry/orders"
          className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md sm:p-6"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-800">Orders to process</h2>
          <p className="mt-1 text-sm text-zinc-600">View incoming orders, record weights, and mark them ready.</p>
        </Link>
      </div>
    </main>
  );
}
