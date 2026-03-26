import Link from "next/link";
import { OrderStatusPill } from "@/components/orders/status-pill";
import { PaymentStatusPill } from "@/components/orders/payment-status-pill";
import { RecordPaymentForm } from "@/components/orders/record-payment-form";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { formatCurrency } from "@/lib/format";
import { getMyOrdersForReception } from "@/lib/actions/orders";
import { receptionOrdersFilterSchema } from "@/lib/validations/filters";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MyOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = {
    q: Array.isArray(params.q) ? params.q[0] : params.q,
    orderStatus: Array.isArray(params.orderStatus) ? params.orderStatus[0] : params.orderStatus,
    from: Array.isArray(params.from) ? params.from[0] : params.from,
    to: Array.isArray(params.to) ? params.to[0] : params.to,
  };
  const parsed = receptionOrdersFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : { q: "" };
  const filteredOrders = await getMyOrdersForReception(filters);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">My orders</h1>
          <p className="mt-0.5 text-sm text-zinc-600">Orders you created (most recent first).</p>
        </div>
        <Link
          href="/reception/orders/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-zinc-800"
        >
          + New order
        </Link>
      </div>

      {/* Filters */}
      <form className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search order # or customer"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          name="orderStatus"
          defaultValue={filters.orderStatus ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="READY">Ready</option>
          <option value="PICKED_UP">Picked Up</option>
        </select>
        <input
          name="from"
          type="date"
          defaultValue={filters.from ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800">
            Apply
          </button>
        </div>
      </form>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center sm:p-12">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-medium text-zinc-700">No orders yet</p>
          <Link
            href="/reception/orders/new"
            className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline"
          >
            Create your first order →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Desktop table (hidden on mobile) ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredOrders.map((order) => {
                    const remaining = parseFloat(order.totalAmount) - parseFloat(order.paidAmount);
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-zinc-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          <Link href={`/reception/orders/${order.id}`} className="text-sky-700 hover:underline">
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
                          <div className="flex flex-col gap-1.5">
                            <PaymentStatusPill status={order.paymentStatus} />
                            <RecordPaymentForm orderId={order.id} remaining={remaining} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusPill status={order.orderStatus} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <OrderStatusActions orderId={order.id} orderStatus={order.orderStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile cards (hidden on desktop) ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredOrders.map((order) => {
              const remaining = parseFloat(order.totalAmount) - parseFloat(order.paidAmount);
              return (
                <Link
                  key={order.id}
                  href={`/reception/orders/${order.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow active:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-medium text-sky-700">{order.orderNumber}</p>
                      <p className="mt-0.5 font-medium text-zinc-900">{order.customerName}</p>
                      <p className="text-xs text-zinc-500">{order.customerPhone}</p>
                    </div>
                    <p className="text-right text-lg font-semibold tabular-nums text-zinc-900">
                      {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OrderStatusPill status={order.orderStatus} />
                    <PaymentStatusPill status={order.paymentStatus} />
                    <span className="text-xs text-zinc-500">{order._count.items} items</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{dateFmt.format(order.createdAt)}</p>
                  {remaining > 0 && (
                    <div className="mt-3 border-t border-zinc-100 pt-3" onClick={(e) => e.preventDefault()}>
                      <RecordPaymentForm orderId={order.id} remaining={remaining} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
