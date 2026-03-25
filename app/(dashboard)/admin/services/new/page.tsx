import Link from "next/link";
import { ServiceCategoryForm } from "@/components/admin/service-category-form";

export default function NewServiceCategoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/services" className="text-sm font-medium text-emerald-800 hover:underline">
        ← Back to services
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">New category</h1>
      <div className="mt-8">
        <ServiceCategoryForm mode="create" />
      </div>
    </main>
  );
}
