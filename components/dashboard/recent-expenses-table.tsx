import Link from "next/link";
import type { RecentExpenseRow } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/format";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

type Props = {
  expenses: RecentExpenseRow[];
};

export function RecentExpensesTable({ expenses }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-900">Recent expenses</h2>
        <Link href="/admin/expenses" className="text-xs font-medium text-emerald-800 hover:underline">
          Manage expenses
        </Link>
      </div>
      {expenses.length === 0 ? (
        <p className="p-6 text-sm text-zinc-500">No expenses in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50/60">
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                    {dateFmt.format(new Date(e.expenseDate))}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-900">{e.categoryName}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-600" title={e.description ?? ""}>
                    {e.description || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums text-zinc-900">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-2 text-zinc-600" title={e.createdByLabel}>
                    {e.createdByLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
