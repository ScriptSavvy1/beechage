import Link from "next/link";
import { getServiceCategoriesForAdmin } from "@/lib/actions/service-catalog";
import { formatCurrency } from "@/lib/format";

export default async function AdminServicesPage() {
  const categories = await getServiceCategoriesForAdmin();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Services &amp; pricing</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Categories and catalog items power reception order lines and prices.
          </p>
        </div>
        <Link
          href="/admin/services/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800"
        >
          New category
        </Link>
      </div>

      <div className="space-y-6">
        {categories.length === 0 ? (
          <p className="text-sm text-zinc-600">No categories yet. Create one to get started.</p>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl border bg-white shadow-sm ${c.isActive ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-80"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-900">{c.name}</h2>
                    {!c.isActive ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        Inactive
                      </span>
                    ) : null}
                    {c.allowsCustomPricing ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                        Custom pricing
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sort {c.sortOrder}
                    {c.allowsCustomPricing ? " · No catalog items at reception" : ` · ${c.items.filter((i) => i.isActive).length} active items`}
                  </p>
                </div>
                <Link
                  href={`/admin/services/${c.id}/edit`}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                >
                  Edit category
                </Link>
              </div>

              {!c.allowsCustomPricing && c.items.length > 0 ? (
                <div className="overflow-x-auto px-5 pb-4">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Order</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {c.items.map((item) => (
                        <tr key={item.id} className={item.isActive ? "" : "text-zinc-400"}>
                          <td className="py-2 pr-4 font-medium text-zinc-900">{item.name}</td>
                          <td className="py-2 pr-4 tabular-nums">{formatCurrency(item.defaultPrice)}</td>
                          <td className="py-2 pr-4 text-zinc-600">{item.sortOrder}</td>
                          <td className="py-2 text-xs">{item.isActive ? "Active" : "Inactive"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
