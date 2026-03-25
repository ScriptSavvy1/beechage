import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function ReceptionHomePage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Reception</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Welcome back</h1>
          <p className="mt-1 text-zinc-600">{session?.user?.email ?? ""}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/reception/orders/new"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-sky-800">New order</h2>
          <p className="mt-2 text-sm text-zinc-600">Create an order with line items and totals.</p>
        </Link>
        <Link
          href="/reception/orders"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-sky-800">My orders</h2>
          <p className="mt-2 text-sm text-zinc-600">View orders you have created.</p>
        </Link>
      </div>
    </main>
  );
}
