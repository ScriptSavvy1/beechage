/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { OrderStatusPill } from "@/components/orders/status-pill";
import { formatCurrency } from "@/lib/format";
import { getOrdersForLaundry } from "@/lib/actions/orders";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LaundryOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const orders = await getOrdersForLaundry({ q: q ?? "", status: status ?? "" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Orders to Process</h1>
        <p className="mt-0.5 text-sm text-zinc-600">Record weight and mark orders ready for pickup.</p>
      </div>

      {/* Filters */}
      <form className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search order # or customer"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">In Progress & Ready</option>
          <option value="IN_PROGRESS">In Progress only</option>
          <option value="READY">Ready only</option>
        </select>
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-800">
          Apply
        </button>
      </form>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center sm:p-12">
          <p className="font-medium text-zinc-700">No orders to process</p>
          <p className="mt-1 text-sm text-zinc-500">Orders from reception will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order: any) => (
                  <tr key={order.id} className="transition-colors hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      <Link href={`/laundry/orders/${order.id}`} className="text-blue-700 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{dateFmt.format(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{order.customerName}</div>
                      <div className="text-xs text-zinc-500">{order.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">{order._count.items}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusPill status={order.orderStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/laundry/orders/${order.id}`}
                        className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        {order.orderStatus === "IN_PROGRESS" ? "Process" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order: any) => (
              <Link
                key={order.id}
                href={`/laundry/orders/${order.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-medium text-blue-700">{order.orderNumber}</span>
                    <p className="mt-0.5 font-medium text-zinc-900">{order.customerName}</p>
                  </div>
                  <p className="text-right text-lg font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <OrderStatusPill status={order.orderStatus} />
                  <span className="text-xs text-zinc-500">{order._count.items} items</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{dateFmt.format(order.createdAt)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
