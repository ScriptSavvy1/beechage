import Link from "next/link";
import { OrderStatusPill } from "@/components/orders/status-pill";
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
  const orders = await getMyOrdersForReception();
  const q = filters.q?.toLowerCase() ?? "";
  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00.000`) : null;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59.999`) : null;
  const filteredOrders = orders.filter((o) => {
    if (
      q &&
      !o.orderNumber.toLowerCase().includes(q) &&
      !(o.notes ?? "").toLowerCase().includes(q)
    )
      return false;
    if (filters.orderStatus && o.orderStatus !== filters.orderStatus) return false;
    if (fromDate && o.createdAt < fromDate) return false;
    if (toDate && o.createdAt > toDate) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">My orders</h1>
          <p className="mt-1 text-sm text-zinc-600">Orders you created (most recent first).</p>
        </div>
        <Link
          href="/reception/orders/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800"
        >
          New order
        </Link>
      </div>
      <form className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search order # or notes"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          name="orderStatus"
          defaultValue={filters.orderStatus ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="READY">READY</option>
          <option value="PICKED_UP">PICKED UP</option>
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
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        </div>
      </form>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-600">No orders yet.</p>
          <Link
            href="/reception/orders/new"
            className="mt-4 inline-block text-sm font-semibold text-sky-700 hover:underline"
          >
            Create your first order
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{dateFmt.format(order.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-700">
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
                    <OrderStatusActions orderId={order.id} orderStatus={order.orderStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
