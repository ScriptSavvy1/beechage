import Link from "next/link";
import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { toDateInputValue } from "@/lib/dates";
import { getExpenseById, getExpenseCategoriesForAdmin } from "@/lib/actions/expenses";

type Props = { params: Promise<{ expenseId: string }> };

export default async function EditExpensePage({ params }: Props) {
  const { expenseId } = await params;
  const [categories, expense] = await Promise.all([
    getExpenseCategoriesForAdmin(),
    getExpenseById(expenseId),
  ]);

  if (!expense) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link href="/admin/expenses" className="text-sm font-medium text-emerald-800 hover:underline">
          ← Back to expenses
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900">Edit expense</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Recorded by {expense.createdBy.name || expense.createdBy.email}
        </p>
      </div>

      <ExpenseForm
        categories={categories}
        mode="edit"
        expenseId={expense.id}
        defaultValues={{
          expenseCategoryId: expense.expenseCategoryId,
          amount: expense.amount.toNumber(),
          expenseDate: toDateInputValue(expense.expenseDate),
          description: expense.description ?? "",
        }}
      />
    </main>
  );
}
