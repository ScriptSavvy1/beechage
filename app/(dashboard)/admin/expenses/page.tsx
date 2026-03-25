import Link from "next/link";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { formatCurrency } from "@/lib/format";
import { getExpensesList } from "@/lib/actions/expenses";
import { adminExpenseFilterSchema, toDateRange } from "@/lib/validations/filters";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = {
    q: Array.isArray(params.q) ? params.q[0] : params.q,
    categoryId: Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId,
    userId: Array.isArray(params.userId) ? params.userId[0] : params.userId,
    from: Array.isArray(params.from) ? params.from[0] : params.from,
    to: Array.isArray(params.to) ? params.to[0] : params.to,
  };
  const parsed = adminExpenseFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : { q: "", categoryId: "", userId: "" };
  const expenses = await getExpensesList();
  const q = filters.q?.toLowerCase() ?? "";
  const range = toDateRange(filters.from, filters.to);
  const filteredExpenses = expenses.filter((x) => {
    if (q && !(x.description ?? "").toLowerCase().includes(q) && !x.categoryName.toLowerCase().includes(q))
      return false;
    if (filters.categoryId && x.expenseCategoryId !== filters.categoryId) return false;
    if (filters.userId && x.createdById !== filters.userId) return false;
    if (range.from && x.expenseDate < range.from) return false;
    if (range.to && x.expenseDate > range.to) return false;
    return true;
  });
  const categoryOptions = [...new Map(expenses.map((e) => [e.expenseCategoryId, e.categoryName])).entries()];
  const userOptions = [...new Map(expenses.map((e) => [e.createdById, e.createdBy.name || e.createdBy.email])).entries()];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Expenses</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Track operating costs. Amounts and categories are validated on save.
          </p>
        </div>
        <Link
          href="/admin/expenses/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800"
        >
          New expense
        </Link>
      </div>
      <form className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Search description/category" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        <select name="categoryId" defaultValue={filters.categoryId ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categoryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select name="userId" defaultValue={filters.userId ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="">All users</option>
          {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <input name="from" type="date" defaultValue={filters.from ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input name="to" type="date" defaultValue={filters.to ?? ""} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        </div>
      </form>

      {filteredExpenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-600">No expenses recorded yet.</p>
          <Link
            href="/admin/expenses/new"
            className="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:underline"
          >
            Add an expense
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Recorded by</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredExpenses.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                      {dateFmt.format(row.expenseDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{row.categoryName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-600" title={row.description ?? ""}>
                      {row.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <span className="block truncate max-w-[140px]" title={row.createdBy.email}>
                        {row.createdBy.name || row.createdBy.email}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/expenses/${row.id}/edit`}
                          className="rounded-md px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                        >
                          Edit
                        </Link>
                        <DeleteExpenseButton expenseId={row.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
