/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusPill } from "@/components/orders/status-pill";
import { formatCurrency } from "@/lib/format";
import { getOrderByIdForLaundry } from "@/lib/actions/orders";
import { WeightInput } from "@/components/laundry/weight-input";
import { MarkReadyButton } from "@/components/laundry/mark-ready-button";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" });

type Props = { params: Promise<{ orderId: string }> };

export default async function LaundryOrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const order = await getOrderByIdForLaundry(orderId);
  if (!order) notFound();

  const isInProgress = order.orderStatus === "IN_PROGRESS";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/laundry/orders" className="text-sm font-medium text-blue-800 hover:underline">
        ← Back to orders
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
            Order {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{dateFmt.format(order.createdAt)}</p>
          <p className="mt-0.5 text-sm text-zinc-600">
            Created by: {order.createdBy?.name || order.createdBy?.email || "—"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <OrderStatusPill status={order.orderStatus} />
          {isInProgress && (
            <MarkReadyButton
              orderId={order.id}
              hasUnweighedKgItems={order.hasUnweighedKgItems}
            />
          )}
        </div>
      </div>

      {/* Customer info */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Customer</h2>
        <p className="mt-1 text-zinc-800">{order.customerName}</p>
        <p className="text-sm text-zinc-500">{order.customerPhone}</p>
        {order.notes && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <strong>Notes:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* Items table with weight */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Order Items</h2>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-2.5">Category</th>
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5 text-center">Qty</th>
                <th className="px-5 py-2.5 text-right">Price</th>
                <th className="px-5 py-2.5 text-right">Total</th>
                <th className="px-5 py-2.5 text-right">Weight (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {order.items.map((item: any) => {
                const isPerKg = item.pricingType === "PER_KG";
                const isWeighed = item.weightKg != null && item.weightKg > 0;
                return (
                  <tr key={item.id} className={isPerKg ? "bg-blue-50/30" : ""}>
                    <td className="px-5 py-2.5 text-zinc-600">{item.categoryName}</td>
                    <td className="px-5 py-2.5 font-medium text-zinc-900">
                      {item.itemName}
                      {isPerKg && (
                        <span className="ml-2 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          ⚖️ Per KG
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-center tabular-nums">
                      {isPerKg ? "—" : item.quantity}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {isPerKg ? (
                        <span className="text-blue-700">{formatCurrency(item.unitPrice)}/kg</span>
                      ) : (
                        formatCurrency(item.unitPrice)
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                      {isPerKg ? (
                        isWeighed ? (
                          <span className="text-blue-700">
                            {formatCurrency(item.unitPrice.toNumber() * item.weightKg)}
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">TBD</span>
                        )
                      ) : (
                        formatCurrency(item.lineTotal)
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {isInProgress ? (
                        <WeightInput
                          orderId={order.id}
                          itemId={item.id}
                          initialWeight={item.weightKg}
                          pricingType={item.pricingType}
                          unitPrice={item.unitPrice.toNumber()}
                        />
                      ) : (
                        <span className="tabular-nums text-zinc-600">
                          {item.weightKg != null ? `${item.weightKg} kg` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-zinc-900">Total</td>
                <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-zinc-900">
                  {order.hasUnweighedKgItems ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Pending weighing
                    </span>
                  ) : (
                    formatCurrency(order.totalAmount)
                  )}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-zinc-100 sm:hidden">
          {order.items.map((item: any) => {
            const isPerKg = item.pricingType === "PER_KG";
            const isWeighed = item.weightKg != null && item.weightKg > 0;
            return (
              <div key={item.id} className={`px-4 py-3 ${isPerKg ? "bg-blue-50/30" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {item.itemName}
                      {isPerKg && (
                        <span className="ml-1 text-[10px] font-semibold text-blue-700">⚖️ Per KG</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">{item.categoryName}</p>
                  </div>
                  <p className="font-medium tabular-nums text-zinc-900">
                    {isPerKg ? (
                      isWeighed ? (
                        formatCurrency(item.unitPrice.toNumber() * item.weightKg)
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">TBD</span>
                      )
                    ) : (
                      formatCurrency(item.lineTotal)
                    )}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>
                    {isPerKg
                      ? `${formatCurrency(item.unitPrice)}/kg`
                      : `${item.quantity} × ${formatCurrency(item.unitPrice)}`}
                  </span>
                  {isInProgress ? (
                    <WeightInput
                      orderId={order.id}
                      itemId={item.id}
                      initialWeight={item.weightKg}
                      pricingType={item.pricingType}
                      unitPrice={item.unitPrice.toNumber()}
                    />
                  ) : (
                    <span>{item.weightKg != null ? `${item.weightKg} kg` : "—"}</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50">
            <span className="text-sm font-semibold text-zinc-900">Total</span>
            <span className="text-sm font-bold tabular-nums text-zinc-900">
              {order.hasUnweighedKgItems ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Pending</span>
              ) : (
                formatCurrency(order.totalAmount)
              )}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
