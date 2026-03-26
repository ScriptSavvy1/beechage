import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function ReceptionHomePage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Reception</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">Welcome back</h1>
          <p className="mt-0.5 text-sm text-zinc-600">{session?.user?.email ?? ""}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/reception/orders/new"
          className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md sm:p-6"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-sky-800">New order</h2>
          <p className="mt-1 text-sm text-zinc-600">Create an order with line items and totals.</p>
        </Link>
        <Link
          href="/reception/orders"
          className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md sm:p-6"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-sky-800">My orders</h2>
          <p className="mt-1 text-sm text-zinc-600">View orders you have created.</p>
        </Link>
      </div>
    </main>
  );
}
