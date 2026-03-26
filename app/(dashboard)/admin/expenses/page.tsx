import Link from "next/link";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { formatCurrency } from "@/lib/format";
import { getExpensesList } from "@/lib/actions/expenses";
import { adminExpenseFilterSchema } from "@/lib/validations/filters";

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
  const [filteredExpenses, allExpenses] = await Promise.all([
    getExpensesList(filters),
    getExpensesList(),
  ]);
  const categoryOptions = [...new Map(allExpenses.map((e) => [e.expenseCategoryId, e.categoryName])).entries()];
  const userOptions = [...new Map(allExpenses.map((e) => [e.createdById, e.createdBy.name || e.createdBy.email])).entries()];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Expenses</h1>
          <p className="mt-0.5 text-sm text-zinc-600">
            Track operating costs. Amounts and categories are validated on save.
          </p>
        </div>
        <Link
          href="/admin/expenses/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-zinc-800"
        >
          + New expense
        </Link>
      </div>

      {/* Filters */}
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
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800">Apply</button>
        </div>
      </form>

      {filteredExpenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center sm:p-12">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-zinc-700">No expenses recorded yet</p>
          <Link
            href="/admin/expenses/new"
            className="mt-3 inline-block text-sm font-semibold text-emerald-800 hover:underline"
          >
            Add an expense →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block">
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
                    <tr key={row.id} className="transition-colors hover:bg-zinc-50/80">
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
                        <span className="block max-w-[140px] truncate" title={row.createdBy.email}>
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

          {/* ── Mobile cards ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredExpenses.map((row) => (
              <div key={row.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{row.categoryName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{dateFmt.format(row.expenseDate)}</p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(row.amount)}
                  </p>
                </div>
                {row.description && (
                  <p className="mt-2 text-sm text-zinc-600">{row.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <p className="text-xs text-zinc-500">
                    By {row.createdBy.name || row.createdBy.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/expenses/${row.id}/edit`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                    >
                      Edit
                    </Link>
                    <DeleteExpenseButton expenseId={row.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
