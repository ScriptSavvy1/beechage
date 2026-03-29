/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/orders/order-form";
import { getOrderById, getServiceCatalogForReception } from "@/lib/actions/orders";
import type { OrderLineInput } from "@/lib/validations/order";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function EditOrderPage({ params }: Props) {
  const { orderId } = await params;
  const [order, catalog] = await Promise.all([
    getOrderById(orderId),
    getServiceCatalogForReception(),
  ]);

  if (!order) notFound();

  // Only IN_PROGRESS orders can be edited
  if (order.orderStatus !== "IN_PROGRESS") {
    notFound();
  }

  // Convert order items back into the form input shape
  const formItems: OrderLineInput[] = order.items.map((item: any) => {
    if (item.serviceItemId) {
      return {
        kind: "catalog" as const,
        serviceCategoryId: item.serviceCategoryId,
        serviceItemId: item.serviceItemId,
        quantity: item.quantity,
      };
    }
    return {
      kind: "custom" as const,
      serviceCategoryId: item.serviceCategoryId,
      customItemName: item.itemName,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href={`/reception/orders/${orderId}`} className="text-sm text-sky-700 hover:underline">
        ← Back to order
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900 sm:text-2xl">
        Edit Order <span className="font-mono">{order.orderNumber}</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        Modify items, customer info, or add new items to this order.
      </p>
      <div className="mt-8">
        <OrderForm
          catalog={catalog}
          mode="edit"
          orderId={orderId}
          defaultValues={{
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            notes: order.notes ?? "",
            items: formItems,
          }}
        />
      </div>
    </main>
  );
}
