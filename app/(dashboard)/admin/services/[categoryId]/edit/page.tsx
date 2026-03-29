import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceCategoryForm } from "@/components/admin/service-category-form";
import { DeactivateCategoryButton } from "@/components/admin/deactivate-category-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { getServiceCategoryById, deleteServiceCategory } from "@/lib/actions/service-catalog";
import { formatCurrency } from "@/lib/format";

interface CatalogItem {
  id: string;
  name: string;
  isActive: boolean;
  pricingType: string;
  defaultPrice: { toNumber: () => number; toString: () => string };
}

type Props = { params: Promise<{ categoryId: string }> };

export default async function EditServiceCategoryPage({ params }: Props) {
  const { categoryId } = await params;
  const category = await getServiceCategoryById(categoryId);
  if (!category) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/services" className="text-sm font-medium text-emerald-800 hover:underline">
        ← Back to services
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Edit: {category.name}</h1>
        <div className="flex gap-4">
          <DeactivateCategoryButton categoryId={category.id} />
          <DeleteButton
            label="Delete category"
            confirmText="Permanently delete this category and all its items?"
            action={deleteServiceCategory}
            args={[category.id]}
            redirectTo="/admin/services"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <ServiceCategoryForm
          mode="edit"
          categoryId={category.id}
          defaultValues={{
            name: category.name,
            sortOrder: category.sortOrder,
            allowsCustomPricing: category.allowsCustomPricing,
            isActive: category.isActive,
          }}
        />

        <aside className="space-y-4">
          {!category.allowsCustomPricing ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Catalog items</h3>
              <p className="mt-1 text-xs text-zinc-500">Add priced items reception staff can select.</p>
              <Link
                href={`/admin/services/${category.id}/items/new`}
                className="mt-4 inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                + Add item
              </Link>
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                {category.items.map((item: CatalogItem) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 border-b border-zinc-50 pb-2">
                    <span className={item.isActive ? "text-zinc-800" : "text-zinc-400"}>
                      {item.name}
                      {item.pricingType === "PER_KG" && (
                        <span className="ml-1 text-[10px] font-semibold text-blue-600">⚖️/kg</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-600">
                      {item.pricingType === "PER_KG"
                        ? `${formatCurrency(item.defaultPrice)}/kg`
                        : formatCurrency(item.defaultPrice)}
                    </span>
                    <Link
                      href={`/admin/services/${category.id}/items/${item.id}/edit`}
                      className="shrink-0 text-xs font-medium text-emerald-800 hover:underline"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 text-sm text-amber-950">
              This category uses custom line entry at reception (item name + price). Catalog items are not used.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
