import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceItemForm } from "@/components/admin/service-item-form";
import { getServiceCategoryById } from "@/lib/actions/service-catalog";

type Props = { params: Promise<{ categoryId: string }> };

export default async function NewServiceItemPage({ params }: Props) {
  const { categoryId } = await params;
  const category = await getServiceCategoryById(categoryId);
  if (!category) notFound();
  if (category.allowsCustomPricing) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-600">
          Custom-pricing categories do not use catalog items.{" "}
          <Link href={`/admin/services/${categoryId}/edit`} className="font-medium text-emerald-800 hover:underline">
            Back to category
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/admin/services/${categoryId}/edit`} className="text-sm font-medium text-emerald-800 hover:underline">
        ← Back to {category.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">New item in {category.name}</h1>
      <div className="mt-8">
        <ServiceItemForm mode="create" categoryId={categoryId} />
      </div>
    </main>
  );
}
