import Link from "next/link";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { getExpenseCategoriesForAdmin } from "@/lib/actions/expenses";

export default async function NewExpensePage() {
  const categories = await getExpenseCategoriesForAdmin();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link href="/admin/expenses" className="text-sm font-medium text-emerald-800 hover:underline">
          ← Back to expenses
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900">New expense</h1>
      </div>

      <ExpenseForm categories={categories} mode="create" />
    </main>
  );
}
