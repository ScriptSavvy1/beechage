import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceItemForm } from "@/components/admin/service-item-form";
import { DeactivateItemButton } from "@/components/admin/deactivate-item-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { getServiceCategoryById, getServiceItemForEdit, deleteServiceItem } from "@/lib/actions/service-catalog";

type Props = { params: Promise<{ categoryId: string; itemId: string }> };

export default async function EditServiceItemPage({ params }: Props) {
  const { categoryId, itemId } = await params;
  const [category, item] = await Promise.all([
    getServiceCategoryById(categoryId),
    getServiceItemForEdit(categoryId, itemId),
  ]);
  if (!category || !item) notFound();
  if (category.allowsCustomPricing) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/admin/services/${categoryId}/edit`} className="text-sm font-medium text-emerald-800 hover:underline">
        ← Back to {category.name}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Edit item</h1>
        <div className="flex gap-4">
          <DeactivateItemButton categoryId={categoryId} itemId={itemId} />
          <DeleteButton
            label="Delete item"
            confirmText="Permanently delete this service item?"
            action={(id: string, catId: string) => deleteServiceItem(id, catId)}
            args={[itemId, categoryId]}
            redirectTo={`/admin/services/${categoryId}/edit`}
          />
        </div>
      </div>
      <div className="mt-8">
        <ServiceItemForm
          mode="edit"
          categoryId={categoryId}
          itemId={itemId}
          defaultValues={{
            name: item.name,
            defaultPrice: item.defaultPrice.toNumber(),
            sortOrder: item.sortOrder,
            isActive: item.isActive,
          }}
        />
      </div>
    </main>
  );
}
