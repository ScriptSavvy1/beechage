import Link from "next/link";
import { OrderForm } from "@/components/orders/order-form";
import { getServiceCatalogForReception } from "@/lib/actions/orders";

export default async function NewOrderPage() {
  const catalog = await getServiceCatalogForReception();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link
          href="/reception/orders"
          className="text-sm font-medium text-sky-700 hover:underline"
        >
          ← Back to my orders
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900">New order</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Choose category and item — prices come from your catalog. Totals update as you change quantity.
        </p>
      </div>

      {catalog.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="font-medium">No service categories configured.</p>
          <p className="mt-2 text-sm">
            Ask an admin to add categories and items under <strong>Admin → Services</strong>, or run{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">npm run db:seed</code>.
          </p>
        </div>
      ) : (
        <OrderForm catalog={catalog} />
      )}
    </main>
  );
}
