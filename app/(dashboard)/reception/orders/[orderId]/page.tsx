import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusPill } from "@/components/orders/status-pill";
import { PaymentStatusPill } from "@/components/orders/payment-status-pill";
import { RecordPaymentForm } from "@/components/orders/record-payment-form";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { formatCurrency } from "@/lib/format";
import { getOrderById } from "@/lib/actions/orders";

interface OrderItemRow {
  id: string;
  categoryName: string;
  itemName: string;
  quantity: number;
  unitPrice: { toNumber: () => number; toString: () => string };
  lineTotal: { toNumber: () => number; toString: () => string };
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();

  const totalAmount = order.totalAmount.toNumber();
  const paidAmount = order.paidAmount.toNumber();
  const remaining = totalAmount - paidAmount;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link href="/reception/orders" className="text-sm text-sky-700 hover:underline">
          ← Back to orders
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
              Order <span className="font-mono">{order.orderNumber}</span>
            </h1>
            <p className="mt-0.5 text-sm text-zinc-600">{dateFmt.format(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.orderStatus} />
            <PaymentStatusPill status={order.paymentStatus} />
          </div>
        </div>
      </div>

      {/* Customer & Meta */}
      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Customer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">Name</p>
            <p className="font-medium text-zinc-900">{order.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Phone</p>
            <p className="font-medium text-zinc-900">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Created by</p>
            <p className="font-medium text-zinc-900">{order.createdBy.name || order.createdBy.email}</p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-zinc-500">Notes</p>
              <p className="text-zinc-700">{order.notes}</p>
            </div>
          )}
        </div>
      </section>

      {/* Items — table on desktop, cards on mobile */}
      <section className="mb-4 rounded-xl border border-zinc-200 bg-white shadow-sm sm:mb-6">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5">
          Items
        </h2>

        {/* Desktop */}
        <div className="hidden sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-2 text-left">Category</th>
                <th className="px-5 py-2 text-left">Item</th>
                <th className="px-5 py-2 text-right">Qty</th>
                <th className="px-5 py-2 text-right">Unit Price</th>
                <th className="px-5 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {order.items.map((item: OrderItemRow) => (
                <tr key={item.id}>
                  <td className="px-5 py-2.5 text-zinc-600">{item.categoryName}</td>
                  <td className="px-5 py-2.5 font-medium text-zinc-900">{item.itemName}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-zinc-700">{item.quantity}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-zinc-700">
                    {formatCurrency(item.unitPrice.toString())}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums text-zinc-900">
                    {formatCurrency(item.lineTotal.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-zinc-100 sm:hidden">
          {order.items.map((item: OrderItemRow) => (
            <div key={item.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{item.itemName}</p>
                  <p className="text-xs text-zinc-500">{item.categoryName}</p>
                </div>
                <p className="font-semibold tabular-nums text-zinc-900">
                  {formatCurrency(item.lineTotal.toString())}
                </p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {item.quantity} × {formatCurrency(item.unitPrice.toString())}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Summary */}
      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Total</span>
            <span className="font-semibold text-zinc-900">{formatCurrency(totalAmount.toFixed(2))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Paid</span>
            <span className="font-medium text-emerald-700">{formatCurrency(paidAmount.toFixed(2))}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm">
            <span className="font-medium text-zinc-800">Remaining</span>
            <span className={`font-semibold ${remaining > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {formatCurrency(remaining.toFixed(2))}
            </span>
          </div>
        </div>
        {remaining > 0 && (
          <div className="mt-4">
            <RecordPaymentForm orderId={order.id} remaining={remaining} />
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <OrderStatusActions orderId={order.id} orderStatus={order.orderStatus} />
        <Link
          href={`/api/orders/${order.id}/receipt`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
        >
          🖨️ Print Receipt
        </Link>
      </div>
    </main>
  );
}
